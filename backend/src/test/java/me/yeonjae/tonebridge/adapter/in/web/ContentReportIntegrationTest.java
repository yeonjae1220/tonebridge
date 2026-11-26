package me.yeonjae.tonebridge.adapter.in.web;

import me.yeonjae.tonebridge.application.port.out.FcmNotificationPort;
import me.yeonjae.tonebridge.application.port.out.NotificationPort;
import me.yeonjae.tonebridge.application.port.out.StoragePort;
import me.yeonjae.tonebridge.application.service.AdminReportService;
import me.yeonjae.tonebridge.support.PostgresIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ContentReportIntegrationTest extends PostgresIntegrationTest {

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired AdminReportService admin;
    @MockitoBean FcmNotificationPort push;
    @MockitoBean NotificationPort sse;
    @MockitoBean StoragePort storage;

    MockMvc mvc;
    UUID reporter, friend, stranger, session, card, nativeAudio, attempt, request, ownRequest, correction;

    @BeforeEach
    void seed() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        // The Postgres container is shared by every test; counts below must only see this test's reports.
        jdbc.update("DELETE FROM content_reports");
        reporter = user();
        friend = user();
        stranger = user();
        session = UUID.randomUUID();
        jdbc.update("INSERT INTO study_sessions(id,created_by,title) VALUES (?,?,'Shared')", session, friend);
        jdbc.update("INSERT INTO session_members(session_id,user_id) VALUES (?,?),(?,?)", session, friend, session, reporter);
        card = UUID.randomUUID();
        jdbc.update("INSERT INTO study_cards(id,session_id,created_by_user_id,phrase,tags) VALUES (?,?,?,'Offensive phrase','')",
                card, session, friend);
        String key = "audio/" + UUID.randomUUID() + "/voice.m4a";
        jdbc.update("INSERT INTO audio_upload_owners(audio_key,owner_id) VALUES (?,?)", key, friend);
        nativeAudio = jdbc.queryForObject("INSERT INTO card_native_audio(card_id,audio_key) VALUES (?,?) RETURNING id",
                UUID.class, card, key);
        attempt = jdbc.queryForObject("""
                INSERT INTO learner_attempts(card_id,learner_id,audio_url,correction_note,score,correction_author_id)
                VALUES (?,?,?,'Rude feedback',2,?) RETURNING id""",
                UUID.class, card, reporter, "audio/" + UUID.randomUUID() + "/try.m4a", friend);
        request = UUID.randomUUID();
        jdbc.update("INSERT INTO correction_requests(id,requester_id,type,target_language,content_text,status,credit_cost)"
                + " VALUES (?,?,'TEXT','en','Spam post','PENDING',0)", request, friend);
        ownRequest = UUID.randomUUID();
        jdbc.update("INSERT INTO correction_requests(id,requester_id,type,target_language,content_text,status,credit_cost)"
                + " VALUES (?,?,'TEXT','en','My post','PENDING',0)", ownRequest, reporter);
        correction = UUID.randomUUID();
        jdbc.update("INSERT INTO corrections(id,request_id,corrector_id,corrected_text,explanation) VALUES (?,?,?,'Insult','x')",
                correction, ownRequest, friend);
    }

    @Test
    void everyVisibleTargetIsReportedAgainstItsAuthorResolvedByTheServer() throws Exception {
        Map<String, UUID> targets = Map.of("USER", friend, "CARD", card, "NATIVE_AUDIO", nativeAudio,
                "ATTEMPT_FEEDBACK", attempt, "CORRECTION_REQUEST", request, "CORRECTION", correction);
        for (var target : targets.entrySet()) {
            report(reporter, target.getKey(), target.getValue(), "HARASSMENT", false).andExpect(status().isCreated());
        }
        assertThat(jdbc.queryForList("SELECT DISTINCT reported_user_id FROM content_reports WHERE reporter_id=?", UUID.class, reporter))
                .containsExactly(friend);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM content_reports WHERE status='OPEN'", Integer.class)).isEqualTo(6);
    }

    @Test
    void contentTheReporterCannotSeeOrDoesNotExistIsNotFound() throws Exception {
        report(stranger, "CARD", card, "SPAM", false)
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("REPORT_001"));
        report(stranger, "ATTEMPT_FEEDBACK", attempt, "SPAM", false).andExpect(status().isNotFound());
        report(reporter, "USER", UUID.randomUUID(), "SPAM", false).andExpect(status().isNotFound());
    }

    @Test
    void ownContentAndSelfCannotBeReported() throws Exception {
        report(reporter, "USER", reporter, "SPAM", false)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("REPORT_002"));
        report(reporter, "CORRECTION_REQUEST", ownRequest, "SPAM", false).andExpect(status().isBadRequest());
    }

    @Test
    void repeatingAnOpenReportReturnsTheSameReport() throws Exception {
        String first = report(reporter, "CARD", card, "SPAM", false).andReturn().getResponse().getContentAsString();
        String second = report(reporter, "CARD", card, "HATE", false).andReturn().getResponse().getContentAsString();
        assertThat(second).isEqualTo(first);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM content_reports", Integer.class)).isEqualTo(1);
    }

    @Test
    void reportingCanAlsoBlockTheAuthor() throws Exception {
        report(reporter, "CARD", card, "HARASSMENT", true).andExpect(status().isCreated());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM user_blocks WHERE blocker_id=? AND blocked_id=?",
                Integer.class, reporter, friend)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM session_members WHERE session_id=? AND user_id=?",
                Integer.class, session, reporter)).isZero();
    }

    @Test
    void aReporterIsLimitedPerDay() throws Exception {
        for (int i = 0; i < 20; i++) {
            jdbc.update("INSERT INTO content_reports(reporter_id,target_type,target_id,reason) VALUES (?,'USER',?,'SPAM')",
                    reporter, UUID.randomUUID());
        }
        report(reporter, "CARD", card, "SPAM", false)
                .andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("REPORT_003"));
    }

    @Test
    void invalidInputAndAnonymousRequestsAreRejected() throws Exception {
        mvc.perform(post("/api/reports").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetType\":\"CARD\",\"targetId\":\"" + card + "\",\"reason\":\"SPAM\"}"))
                .andExpect(status().isUnauthorized());
        report(reporter, "CARD", card, "NOT_A_REASON", false).andExpect(status().isBadRequest());
        mvc.perform(post("/api/reports").with(as(reporter)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetType\":\"CARD\",\"targetId\":\"" + card + "\",\"reason\":\"SPAM\",\"detail\":\"" + "x".repeat(501) + "\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void theOperatorSeesTheReportedContentAndCanRemoveIt() throws Exception {
        report(reporter, "CARD", card, "HATE", false);
        report(stranger, "USER", friend, "HATE", false);

        List<AdminReportService.OpenReport> open = admin.open();
        assertThat(open).hasSize(2);
        var cardReport = open.stream().filter(r -> r.type().name().equals("CARD")).findFirst().orElseThrow();
        assertThat(cardReport.content()).contains("Offensive phrase");
        assertThat(cardReport.reportsAgainstUser()).isEqualTo(2);

        admin.removeContent(cardReport.id());
        assertThat(jdbc.queryForObject("SELECT deleted_at IS NOT NULL FROM study_cards WHERE id=?", Boolean.class, card)).isTrue();
        assertThat(admin.open()).hasSize(1);
    }

    @Test
    void removingFeedbackClearsItButKeepsTheAttempt() throws Exception {
        report(reporter, "ATTEMPT_FEEDBACK", attempt, "HARASSMENT", false);
        admin.removeContent(admin.open().get(0).id());
        assertThat(jdbc.queryForObject("SELECT correction_note FROM learner_attempts WHERE id=?", String.class, attempt)).isNull();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM learner_attempts WHERE id=?", Integer.class, attempt)).isEqualTo(1);
    }

    @Test
    void theOperatorCanDismissOrDeleteTheAccount() throws Exception {
        report(reporter, "CARD", card, "SPAM", false);
        admin.dismiss(admin.open().get(0).id());
        assertThat(admin.open()).isEmpty();

        report(reporter, "USER", friend, "HARASSMENT", false);
        admin.deleteAccount(admin.open().get(0).id());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users WHERE id=?", Integer.class, friend)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM content_reports WHERE resolution='ACCOUNT_DELETED'", Integer.class))
                .isEqualTo(1);
    }

    private ResultActions report(UUID who, String type, UUID target, String reason, boolean alsoBlock) throws Exception {
        return mvc.perform(post("/api/reports").with(as(who)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"targetType\":\"" + type + "\",\"targetId\":\"" + target + "\",\"reason\":\"" + reason
                        + "\",\"alsoBlock\":" + alsoBlock + "}"));
    }

    private UUID user() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO users(id,email,username,native_language) VALUES (?,?,?,'en')",
                id, id + "@test.invalid", "u" + id.toString().substring(0, 12));
        return id;
    }

    private static RequestPostProcessor as(UUID user) {
        return authentication(new UsernamePasswordAuthenticationToken(user, null, List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }
}
