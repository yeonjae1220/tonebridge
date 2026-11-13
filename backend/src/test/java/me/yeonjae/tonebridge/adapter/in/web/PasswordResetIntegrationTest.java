package me.yeonjae.tonebridge.adapter.in.web;

import me.yeonjae.tonebridge.support.PostgresIntegrationTest;
import me.yeonjae.tonebridge.application.service.*;
import me.yeonjae.tonebridge.application.port.out.*;
import me.yeonjae.tonebridge.shared.security.*;
import me.yeonjae.tonebridge.shared.util.JwtProvider;
import me.yeonjae.tonebridge.shared.exception.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import jakarta.servlet.http.Cookie;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.http.MediaType.APPLICATION_JSON;

@TestPropertySource(properties={"tonebridge.password-reset.enabled=true","tonebridge.password-reset.host=localhost",
        "tonebridge.password-reset.username=test","tonebridge.password-reset.password=test-only",
        "tonebridge.password-reset.from=sender@example.test","tonebridge.password-reset.base-url=https://tonebridge.example.test"})
class PasswordResetIntegrationTest extends PostgresIntegrationTest {
    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired AuthService auth;
    @Autowired PasswordResetService reset;
    @Autowired UserPort users;
    @Autowired JwtProvider jwt;
    @Autowired me.yeonjae.tonebridge.shared.config.JwtProperties jwtProperties;
    @Autowired me.yeonjae.tonebridge.shared.config.PasswordResetProperties properties;
    @MockitoBean PasswordResetRateLimiter limits;
    @MockitoBean PasswordResetMailPort mail;
    @MockitoBean RefreshTokenPort refresh;
    MockMvc mvc;
    String email;
    UUID id;
    me.yeonjae.tonebridge.adapter.in.web.dto.TokenResponse oldTokens;
    @BeforeEach void setup() {
        mvc=MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        when(limits.allowRequest(any(),anyString())).thenReturn(true);
        when(limits.allowMail()).thenReturn(true);
        email="reset-"+UUID.randomUUID()+"@example.test";
        oldTokens=auth.register(email,"u"+UUID.randomUUID().toString().replace("-", "").substring(0,15),"OldPass1!");
        id=jwt.parseAccessClaims(oldTokens.accessToken()).userId();
    }
    private org.springframework.test.web.servlet.ResultActions confirm(String token,String password) throws Exception {
        return mvc.perform(post("/api/auth/password-reset/confirm").contentType(APPLICATION_JSON)
                .content("{\"token\":\""+token+"\",\"password\":\""+password+"\"}"));
    }
    @Test void requestDoesNotDiscloseAccountsAndOnlyLocalAccountsReceiveMail() throws Exception {
        String missing="missing-"+UUID.randomUUID()+"@example.test";
        String google="google-"+UUID.randomUUID()+"@example.test";
        var googleTokens=auth.register(google,"g"+UUID.randomUUID().toString().substring(0,8),"OldPass1!");
        UUID googleId=jwt.parseAccessClaims(googleTokens.accessToken()).userId();
        jdbc.update("UPDATE users SET provider='GOOGLE',password_hash=NULL WHERE id=?",googleId);
        for(String address:List.of(email,missing,google)) mvc.perform(post("/api/auth/password-reset").contentType(APPLICATION_JSON)
                .content("{\"email\":\""+address+"\"}")).andExpect(status().isAccepted()).andExpect(content().string(""));
        verify(mail,timeout(3000)).send(eq(email),matches("[A-Za-z0-9_-]{43}"));
        assertThat(reset.issue(missing)).isEmpty();assertThat(reset.issue(google)).isEmpty();
        verify(mail,never()).send(eq(missing),anyString());verify(mail,never()).send(eq(google),anyString());
        mvc.perform(get("/api/auth/password-reset/status")).andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true)).andExpect(jsonPath("$.host").doesNotExist());
    }
    @Test void successfulResetIsSingleUseAndRevokesAccessRefreshAndOtherResetTokens() throws Exception {
        String token=reset.issue(email).orElseThrow().token();
        String second=reset.issue(email).orElseThrow().token();
        var stored=jdbc.queryForList("SELECT token_hash FROM password_reset_tokens WHERE user_id=?",id);
        assertThat(stored.toString()).doesNotContain(token,second).contains(TokenDigest.sha256(token));
        when(refresh.findUserIdByToken(oldTokens.refreshToken())).thenReturn(Optional.of(id));
        mvc.perform(get("/api/users/me").header("Authorization","Bearer "+oldTokens.accessToken())).andExpect(status().isOk());
        confirm(token,"NewPass2!").andExpect(status().isNoContent()).andExpect(content().string(""));
        assertThat(users.credentialsVersion(id)).isEqualTo(1);
        confirm(token,"OtherPass3!").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("AUTH_007"));
        confirm(second,"OtherPass3!").andExpect(status().isBadRequest());
        mvc.perform(get("/api/users/me").header("Authorization","Bearer "+oldTokens.accessToken())).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/refresh").cookie(new Cookie("refresh_token",oldTokens.refreshToken()))).andExpect(status().isUnauthorized());
        assertThatThrownBy(()->auth.loginLocal(email,"OldPass1!")).isInstanceOf(ToneBridgeException.class);
        var fresh=auth.loginLocal(email,"NewPass2!");
        assertThat(jwt.parseAccessClaims(fresh.accessToken()).credentialsVersion()).isEqualTo(1);
        mvc.perform(get("/api/users/me").header("Authorization","Bearer "+fresh.accessToken())).andExpect(status().isOk());
        verify(refresh).deleteAllByUserId(id);
        users.save(users.findById(id).orElseThrow());
        assertThat(users.credentialsVersion(id)).isEqualTo(1);
    }
    @Test void expiredMalformedAndWeakInputsCannotChangePassword() throws Exception {
        String token=reset.issue(email).orElseThrow().token();
        confirm(token,"weak").andExpect(status().isBadRequest());
        confirm("bad","NewPass2!").andExpect(status().isBadRequest());
        jdbc.update("UPDATE password_reset_tokens SET expires_at=now()-interval '1 minute' WHERE user_id=?",id);
        confirm(token,"NewPass2!").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("AUTH_007"));
        assertThat(users.credentialsVersion(id)).isZero();
        assertThat(auth.loginLocal(email,"OldPass1!")).isNotNull();
    }
    @Test void disabledConfigurationIsExplicitAndSendsNothing() throws Exception {
        properties.setEnabled(false);
        try {
            mvc.perform(get("/api/auth/password-reset/status")).andExpect(status().isOk()).andExpect(jsonPath("$.enabled").value(false));
            mvc.perform(post("/api/auth/password-reset").contentType(APPLICATION_JSON).content("{\"email\":\""+email+"\"}"))
                    .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("AUTH_008"));
            verifyNoInteractions(mail);
        } finally {properties.setEnabled(true);}
    }
    @Test void preUpgradeJwtRemainsValidUntilThatAccountResets() throws Exception {
        String legacy=io.jsonwebtoken.Jwts.builder().subject(id.toString()).claim("token_type","access").claim("admin",false)
                .expiration(java.util.Date.from(java.time.Instant.now().plusSeconds(60)))
                .signWith(io.jsonwebtoken.security.Keys.hmacShaKeyFor(jwtProperties.getSecret().getBytes(java.nio.charset.StandardCharsets.UTF_8))).compact();
        mvc.perform(get("/api/users/me").header("Authorization","Bearer "+legacy)).andExpect(status().isOk());
        reset.confirm(reset.issue(email).orElseThrow().token(),"NewPass2!");
        mvc.perform(get("/api/users/me").header("Authorization","Bearer "+legacy)).andExpect(status().isUnauthorized());
    }
    @Test void resetClosesEveryExistingNotificationStream() throws Exception {
        var first=mvc.perform(get("/api/sse/notifications").header("Authorization","Bearer "+oldTokens.accessToken()))
                .andExpect(request().asyncStarted()).andReturn();
        var second=mvc.perform(get("/api/sse/notifications").header("Authorization","Bearer "+oldTokens.accessToken()))
                .andExpect(request().asyncStarted()).andReturn();
        reset.confirm(reset.issue(email).orElseThrow().token(),"NewPass2!");
        assertThat(first.getAsyncResult(2000)).isNull();assertThat(second.getAsyncResult(2000)).isNull();
    }
    @Test void bcryptLengthBoundaryIsValidatedBeforeHashing() throws Exception {
        String token=reset.issue(email).orElseThrow().token();
        String boundary="Ab1!"+"x".repeat(68);
        confirm(token,boundary+"x").andExpect(status().isBadRequest());
        confirm(token,boundary).andExpect(status().isNoContent());
        assertThat(auth.loginLocal(email,boundary)).isNotNull();
    }
    @Test void concurrentConfirmationCanSucceedOnlyOnce() throws Exception {
        String token=reset.issue(email).orElseThrow().token();
        var start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            Callable<Boolean> task=()->{ start.await();try {reset.confirm(token,"NewPass2!");return true;}catch(ToneBridgeException ex){return false;} };
            var one=pool.submit(task);var two=pool.submit(task);start.countDown();
            assertThat(List.of(one.get(10,TimeUnit.SECONDS),two.get(10,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
        }
        assertThat(users.credentialsVersion(id)).isEqualTo(1);
    }
    @Test void failedRevocationRollsBackPasswordAndTokenConsumption() {
        String token=reset.issue(email).orElseThrow().token();
        doThrow(new IllegalStateException("unavailable")).when(refresh).deleteAllByUserId(id);
        assertThatThrownBy(()->reset.confirm(token,"NewPass2!")).isInstanceOf(IllegalStateException.class);
        assertThat(users.credentialsVersion(id)).isZero();assertThat(auth.loginLocal(email,"OldPass1!")).isNotNull();
        doNothing().when(refresh).deleteAllByUserId(id);
        reset.confirm(token,"NewPass2!");assertThat(users.credentialsVersion(id)).isEqualTo(1);
    }
    @Test void throttledRequestsStayGenericAndConfirmLimitStopsChanges() throws Exception {
        when(limits.allowRequest(any(),anyString())).thenReturn(false);
        mvc.perform(post("/api/auth/password-reset").contentType(APPLICATION_JSON).content("{\"email\":\""+email+"\"}"))
                .andExpect(status().isAccepted()).andExpect(content().string(""));
        verifyNoInteractions(mail);
        String token=reset.issue(email).orElseThrow().token();
        doThrow(new ToneBridgeException(ErrorCode.TOO_MANY_REQUESTS)).when(limits).checkConfirmation(any());
        confirm(token,"NewPass2!").andExpect(status().isTooManyRequests());assertThat(users.credentialsVersion(id)).isZero();
    }
    @Test void rejectedValuesNeverReachValidationLogs() throws Exception {
        var logger=(ch.qos.logback.classic.Logger)org.slf4j.LoggerFactory.getLogger(GlobalExceptionHandler.class);
        var logs=new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();logs.start();logger.addAppender(logs);
        try {
            confirm("PRIVATE_RESET_TOKEN_123","PRIVATE_PASSWORD_123").andExpect(status().isBadRequest());
            String text=logs.list.stream().map(ch.qos.logback.classic.spi.ILoggingEvent::getFormattedMessage).reduce("",String::concat);
            assertThat(text).doesNotContain("PRIVATE_RESET_TOKEN_123","PRIVATE_PASSWORD_123");
        } finally {logger.detachAppender(logs);logs.stop();}
    }
}
