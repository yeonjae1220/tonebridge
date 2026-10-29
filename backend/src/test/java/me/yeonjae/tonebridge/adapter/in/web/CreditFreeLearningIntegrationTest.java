package me.yeonjae.tonebridge.adapter.in.web;

import me.yeonjae.tonebridge.application.port.in.AcceptCorrectionUseCase;
import me.yeonjae.tonebridge.application.service.QualityCheckCompletedEvent;
import me.yeonjae.tonebridge.application.service.QualityCheckEventHandler;
import me.yeonjae.tonebridge.support.PostgresIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Uses PostgreSQL constraints, Flyway, API validation and the real security filters. */
@org.springframework.test.context.TestPropertySource(properties = {
        "tonebridge.credit.signup-bonus=30",
        "tonebridge.credit.text-request-cost=5",
        "tonebridge.credit.audio-request-cost=10",
        "tonebridge.credit.accept-bonus=5",
        "tonebridge.credit.streak7day-bonus=10"
})
class CreditFreeLearningIntegrationTest extends PostgresIntegrationTest {
    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired QualityCheckEventHandler qualityHandler;
    @Autowired AcceptCorrectionUseCase acceptCorrection;
    MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test
    void zeroBalanceCanSubmitTextAndAudioWithoutLedgerWrites() throws Exception {
        UUID user = insertUser();
        assertThat(balance(user)).isZero();
        mvc.perform(post("/api/correction-requests").with(as(user, "ROLE_USER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetLanguage\":\"en\",\"contentText\":\"Please help me practise\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.creditCost").value(0));
        mvc.perform(post("/api/correction-requests/audio").with(as(user, "ROLE_USER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetLanguage\":\"en\",\"audioKey\":\"audio/" + user + "/practice.m4a\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.creditCost").value(0));
        assertThat(balance(user)).isZero();
        assertThat(ledgerRows(user)).isZero();
    }

    @Test
    void oldBalanceAndHistorySurviveRequestsAcceptanceAndDelayedRewards() throws Exception {
        UUID requester = insertUser();
        UUID corrector = insertUser();
        jdbc.update("UPDATE users SET credits = 42, correction_streak = 6, last_correction_date = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - 1 WHERE id = ?", corrector);
        jdbc.update("INSERT INTO credit_transactions (user_id, amount, type, note) VALUES (?, 42, 'EARN', 'historical')", corrector);

        mvc.perform(post("/api/correction-requests").with(as(corrector, "ROLE_USER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetLanguage\":\"en\",\"contentText\":\"My own practice\"}"))
                .andExpect(status().isCreated());

        UUID request = UUID.randomUUID();
        UUID correction = UUID.randomUUID();
        // Pre-cutover records still have positive cost/reward fields.
        jdbc.update("INSERT INTO correction_requests (id, requester_id, type, content_text, target_language, credit_cost) VALUES (?, ?, 'TEXT', 'hello', 'en', 5)", request, requester);
        jdbc.update("INSERT INTO corrections (id, request_id, corrector_id, credit_earned) VALUES (?, ?, ?, 4)", correction, request, corrector);
        acceptCorrection.accept(new AcceptCorrectionUseCase.Command(correction, requester));
        qualityHandler.handle(new QualityCheckCompletedEvent(correction, corrector, requester, true, 12, true));

        assertThat(balance(corrector)).isEqualTo(42);
        assertThat(ledgerRows(corrector)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT correction_streak FROM users WHERE id = ?", Integer.class, corrector)).isEqualTo(7);
        assertThat(jdbc.queryForObject("SELECT status FROM corrections WHERE id = ?", String.class, correction)).isEqualTo("APPROVED");
        mvc.perform(get("/api/credits/history").with(as(corrector, "ROLE_USER")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].note").value("historical"));
        mvc.perform(get("/api/credits/history").with(as(requester, "ROLE_USER")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void legacyAdminAdjustmentIsGoneAndStillRequiresAdmin() throws Exception {
        UUID user = insertUser();
        mvc.perform(patch("/api/admin/users/{id}/credits", user).param("delta", "10").with(as(user, "ROLE_USER")))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/admin/users/{id}/credits", user).param("delta", "10").with(as(user, "ROLE_ADMIN")))
                .andExpect(status().isGone()).andExpect(jsonPath("$.code").value("CREDIT_002"));
        assertThat(balance(user)).isZero();
        assertThat(ledgerRows(user)).isZero();
    }

    @Test
    void legacyGoogleUsernameAtStorageLimitCanBeInvitedWithoutAutomaticAcceptance() throws Exception {
        UUID sender = insertUser();
        UUID receiver = insertUser();
        String username = "a".repeat(41) + "_12345678";
        jdbc.update("UPDATE users SET username = ?, provider = 'GOOGLE' WHERE id = ?", username, receiver);

        mvc.perform(get("/api/users/search").param("q", username).with(as(sender, "ROLE_USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].username").value(username))
                .andExpect(jsonPath("$[0].id").value(receiver.toString()))
                .andExpect(jsonPath("$[0].email").doesNotExist());
        mvc.perform(post("/api/friends/request").with(as(sender, "ROLE_USER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"receiverUsername\":\"" + username + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.receiverId").value(receiver.toString()))
                .andExpect(jsonPath("$.status").value("PENDING"));
        mvc.perform(get("/api/friends").with(as(sender, "ROLE_USER")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }

    private UUID insertUser() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO users (id, email, username, native_language) VALUES (?, ?, ?, 'ko')", id, id + "@test.example.com", "u" + id.toString().substring(0, 8));
        return id;
    }

    private int balance(UUID user) {
        return jdbc.queryForObject("SELECT credits FROM users WHERE id = ?", Integer.class, user);
    }

    private int ledgerRows(UUID user) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM credit_transactions WHERE user_id = ?", Integer.class, user);
    }

    private static RequestPostProcessor as(UUID user, String role) {
        return authentication(new UsernamePasswordAuthenticationToken(user, null, List.of(new SimpleGrantedAuthority(role))));
    }
}
