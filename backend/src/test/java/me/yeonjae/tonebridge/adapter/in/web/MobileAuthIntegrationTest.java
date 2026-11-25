package me.yeonjae.tonebridge.adapter.in.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import me.yeonjae.tonebridge.adapter.out.ai.GoogleUserInfo;
import me.yeonjae.tonebridge.application.port.out.AppleIdentityTokenPort;
import me.yeonjae.tonebridge.application.port.out.GoogleOAuthPort;
import me.yeonjae.tonebridge.application.port.out.AppleIdentityTokenPort.AppleIdentity;
import me.yeonjae.tonebridge.application.port.out.RefreshTokenPort;
import me.yeonjae.tonebridge.application.service.AuthService;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import me.yeonjae.tonebridge.shared.security.LoginRateLimiter;
import me.yeonjae.tonebridge.shared.util.JwtProvider;
import me.yeonjae.tonebridge.support.PostgresIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Email and Apple sign-in for the native app: tokens in the body, never cookies. */
class MobileAuthIntegrationTest extends PostgresIntegrationTest {

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired AuthService auth;
    @Autowired JwtProvider jwt;
    @MockitoBean LoginRateLimiter limits;
    @MockitoBean RefreshTokenPort refreshTokens;
    @MockitoBean AppleIdentityTokenPort appleTokens;
    @MockitoBean GoogleOAuthPort googleTokens;

    private final ObjectMapper json = new ObjectMapper();
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    private static String unique(String prefix) {
        return prefix + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    private ResultActions postJson(String path, String body) throws Exception {
        return mvc.perform(post(path).contentType(APPLICATION_JSON).content(body));
    }

    private UUID userIdOf(ResultActions result) throws Exception {
        JsonNode body = json.readTree(result.andReturn().getResponse().getContentAsString());
        return jwt.parseAccessClaims(body.get("accessToken").asText()).userId();
    }

    @Test
    @DisplayName("email register and login return access + refresh tokens in the body and set no cookie")
    void emailRegisterAndLogin() throws Exception {
        String email = unique("m") + "@example.test";
        String register = "{\"email\":\"" + email + "\",\"username\":\"" + unique("u") + "\",\"password\":\"Passw0rd!\"}";

        UUID registered = userIdOf(postJson("/api/auth/mobile/register", register)
                .andExpect(status().isCreated())
                .andExpect(header().doesNotExist("Set-Cookie"))
                .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                .andExpect(jsonPath("$.needsOnboarding").value(true)));

        UUID loggedIn = userIdOf(postJson("/api/auth/mobile/login",
                "{\"email\":\"" + email.toUpperCase() + "\",\"password\":\"Passw0rd!\"}")
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist("Set-Cookie"))
                .andExpect(jsonPath("$.refreshToken").isNotEmpty()));

        assertThat(loggedIn).isEqualTo(registered);
        verify(limits).checkRegister(any(), eq(email));
    }

    @Test
    @DisplayName("wrong password is the generic LOGIN_FAILED and counts toward the rate limit")
    void emailLoginFailureIsCounted() throws Exception {
        String email = unique("m") + "@example.test";
        auth.register(email, unique("u"), "Passw0rd!");

        postJson("/api/auth/mobile/login", "{\"email\":\"" + email + "\",\"password\":\"Wrong0rd!\"}")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_005"));

        verify(limits).recordLoginFailure(any(), eq(email));
    }

    @Test
    @DisplayName("rate-limited login is rejected before the password is checked")
    void emailLoginRateLimited() throws Exception {
        doThrow(new ToneBridgeException(ErrorCode.TOO_MANY_REQUESTS)).when(limits).checkLogin(any(), anyString());

        postJson("/api/auth/mobile/login", "{\"email\":\"x@example.test\",\"password\":\"Passw0rd!\"}")
                .andExpect(status().isTooManyRequests());

        verify(limits, never()).recordLoginFailure(any(), anyString());
    }

    @Test
    @DisplayName("first Apple sign-in creates an APPLE account; later sign-ins without email find it by sub")
    void appleCreatesThenFindsBySub() throws Exception {
        String sub = unique("apple.");
        String email = unique("relay") + "@privaterelay.appleid.com";
        when(appleTokens.verify("first")).thenReturn(new AppleIdentity(sub, email, true));
        when(appleTokens.verify("later")).thenReturn(new AppleIdentity(sub, null, false));

        UUID created = userIdOf(postJson("/api/auth/mobile/apple", "{\"identityToken\":\"first\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.needsOnboarding").value(true)));
        UUID again = userIdOf(postJson("/api/auth/mobile/apple", "{\"identityToken\":\"later\"}")
                .andExpect(status().isOk()));

        assertThat(again).isEqualTo(created);
        assertThat(jdbc.queryForObject("SELECT provider FROM users WHERE id=?", String.class, created)).isEqualTo("APPLE");
        assertThat(jdbc.queryForObject("SELECT email FROM users WHERE id=?", String.class, created)).isEqualTo(email);
    }

    @Test
    @DisplayName("Apple sign-in with the verified email of an existing account links to that account")
    void appleLinksExistingAccountByVerifiedEmail() throws Exception {
        String email = unique("m") + "@example.test";
        var tokens = auth.register(email, unique("u"), "Passw0rd!");
        UUID existing = jwt.parseAccessClaims(tokens.accessToken()).userId();
        String sub = unique("apple.");
        when(appleTokens.verify("t")).thenReturn(new AppleIdentity(sub, email.toUpperCase(), true));

        UUID signedIn = userIdOf(postJson("/api/auth/mobile/apple", "{\"identityToken\":\"t\"}").andExpect(status().isOk()));

        assertThat(signedIn).isEqualTo(existing);
        assertThat(jdbc.queryForObject("SELECT user_id FROM user_apple_identities WHERE apple_sub=?", UUID.class, sub))
                .isEqualTo(existing);
        assertLocalAccountTakenOver(existing, email, "APPLE");
    }

    @Test
    @DisplayName("Google sign-in with the email of a pre-registered local account also revokes that password")
    void googleTakesOverPreRegisteredLocalAccount() throws Exception {
        String email = unique("m") + "@example.test";
        UUID squatted = jwt.parseAccessClaims(auth.register(email, unique("u"), "Passw0rd!").accessToken()).userId();
        when(googleTokens.verifyIdToken("g")).thenReturn(new GoogleUserInfo(unique("g"), email, "Owner", null));

        UUID signedIn = userIdOf(postJson("/api/auth/mobile/google/id-token", "{\"idToken\":\"g\"}")
                .andExpect(status().isOk()));

        assertThat(signedIn).isEqualTo(squatted);
        assertLocalAccountTakenOver(squatted, email, "GOOGLE");
    }

    /**
     * Email sign-up never proves the address, so whoever set the password may not own it. Once the
     * provider vouches for the owner, that password and every session issued with it must be dead.
     */
    private void assertLocalAccountTakenOver(UUID userId, String email, String provider) throws Exception {
        assertThat(jdbc.queryForObject("SELECT provider FROM users WHERE id=?", String.class, userId)).isEqualTo(provider);
        assertThat(jdbc.queryForObject("SELECT password_hash FROM users WHERE id=?", String.class, userId)).isNull();
        assertThat(jdbc.queryForObject("SELECT credentials_version FROM users WHERE id=?", Long.class, userId)).isEqualTo(1L);
        verify(refreshTokens).deleteAllByUserId(userId);
        postJson("/api/auth/mobile/login", "{\"email\":\"" + email + "\",\"password\":\"Passw0rd!\"}")
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("signing in again with Apple leaves an already-social account alone")
    void appleRepeatSignInDoesNotRevokeSessions() throws Exception {
        String sub = unique("apple.");
        when(appleTokens.verify("a")).thenReturn(new AppleIdentity(sub, unique("r") + "@privaterelay.appleid.com", true));
        UUID id = userIdOf(postJson("/api/auth/mobile/apple", "{\"identityToken\":\"a\"}").andExpect(status().isOk()));
        postJson("/api/auth/mobile/apple", "{\"identityToken\":\"a\"}").andExpect(status().isOk());

        verify(refreshTokens, never()).deleteAllByUserId(id);
        assertThat(jdbc.queryForObject("SELECT credentials_version FROM users WHERE id=?", Long.class, id)).isZero();
    }

    @Test
    @DisplayName("unknown Apple sub without a verified email is refused and creates nothing")
    void appleWithoutVerifiedEmailIsRefused() throws Exception {
        String sub = unique("apple.");
        when(appleTokens.verify("noemail")).thenReturn(new AppleIdentity(sub, null, false));
        when(appleTokens.verify("unverified")).thenReturn(new AppleIdentity(sub, unique("x") + "@example.test", false));

        for (String token : new String[]{"noemail", "unverified"}) {
            postJson("/api/auth/mobile/apple", "{\"identityToken\":\"" + token + "\"}")
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("AUTH_009"));
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM user_apple_identities WHERE apple_sub=?", Integer.class, sub))
                .isZero();
    }

    @Test
    @DisplayName("invalid identity token is 401 AUTH_009; blank token is 400")
    void appleInvalidToken() throws Exception {
        when(appleTokens.verify("bad")).thenThrow(new ToneBridgeException(ErrorCode.APPLE_AUTH_FAILED));

        postJson("/api/auth/mobile/apple", "{\"identityToken\":\"bad\"}")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_009"));
        postJson("/api/auth/mobile/apple", "{\"identityToken\":\"\"}").andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("deleting the account removes its Apple link, so the same Apple ID starts fresh")
    void accountDeletionCascadesAppleLink() throws Exception {
        String sub = unique("apple.");
        when(appleTokens.verify("t")).thenReturn(new AppleIdentity(sub, unique("r") + "@privaterelay.appleid.com", true));
        UUID user = userIdOf(postJson("/api/auth/mobile/apple", "{\"identityToken\":\"t\"}").andExpect(status().isOk()));

        jdbc.update("DELETE FROM users WHERE id=?", user);

        assertThat(jdbc.queryForObject("SELECT count(*) FROM user_apple_identities WHERE apple_sub=?", Integer.class, sub))
                .isZero();
    }
}
