package me.yeonjae.tonebridge.adapter.in.web;

import me.yeonjae.tonebridge.support.PostgresIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real filters, membership persistence and S3 signing; no external object is uploaded. */
class StudyAttemptAudioIntegrationTest extends PostgresIntegrationTest {
    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    MockMvc mvc;
    UUID owner, partner, outsider, sessionId, cardId, attemptId;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        owner = user(); partner = user(); outsider = user();
        sessionId = UUID.randomUUID(); cardId = UUID.randomUUID(); attemptId = UUID.randomUUID();
        jdbc.update("INSERT INTO study_sessions (id, created_by) VALUES (?, ?)", sessionId, owner);
        for (UUID member : List.of(owner, partner)) {
            jdbc.update("INSERT INTO session_members (session_id, user_id) VALUES (?, ?)", sessionId, member);
        }
        jdbc.update("INSERT INTO study_cards (id, session_id, created_by_user_id, phrase) VALUES (?, ?, ?, 'hello')", cardId, sessionId, owner);
        jdbc.update("INSERT INTO learner_attempts (id, card_id, learner_id, audio_url) VALUES (?, ?, ?, ?)",
                attemptId, cardId, partner, "audio/" + UUID.randomUUID() + "/practice.webm");
    }

    @Test
    void bothParticipantsCanPlayTheSavedAttempt() throws Exception {
        for (UUID member : List.of(owner, partner)) {
            mvc.perform(get("/api/attempts/{id}/download-url", attemptId).with(as(member)))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Cache-Control", "no-store"))
                    .andExpect(jsonPath("$.downloadUrl", containsString("practice.webm")))
                    .andExpect(jsonPath("$.downloadUrl", containsString("X-Amz-Signature=")))
                    .andExpect(jsonPath("$.downloadUrl", containsString("X-Amz-Expires=900")));
        }
    }

    @Test
    void anonymousAndNonMembersCannotObtainAPlaybackUrl() throws Exception {
        mvc.perform(get("/api/attempts/{id}/download-url", attemptId)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/attempts/{id}/download-url", attemptId).with(as(outsider)))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.downloadUrl").doesNotExist());
    }

    @Test
    void formerOwnerAndLearnerLoseAccessWhenMembershipIsRevoked() throws Exception {
        jdbc.update("DELETE FROM session_members WHERE session_id = ?", sessionId);
        for (UUID member : List.of(owner, partner)) {
            mvc.perform(get("/api/attempts/{id}/download-url", attemptId).with(as(member)))
                    .andExpect(status().isForbidden()).andExpect(jsonPath("$.downloadUrl").doesNotExist());
        }
    }

    @Test
    void deletedCardCannotIssueANewUrl() throws Exception {
        jdbc.update("UPDATE study_cards SET deleted_at = now() WHERE id = ?", cardId);
        mvc.perform(get("/api/attempts/{id}/download-url", attemptId).with(as(partner)))
                .andExpect(status().isNotFound());
    }

    @Test
    void deletedNotebookCannotIssueANewUrl() throws Exception {
        jdbc.update("UPDATE study_sessions SET deleted_at = now() WHERE id = ?", sessionId);
        mvc.perform(get("/api/attempts/{id}/download-url", attemptId).with(as(partner)))
                .andExpect(status().isNotFound());
    }

    @Test
    void missingAttemptAndBlankRecordingHaveExplicitErrors() throws Exception {
        mvc.perform(get("/api/attempts/{id}/download-url", UUID.randomUUID()).with(as(owner)))
                .andExpect(status().isNotFound());
        jdbc.update("UPDATE learner_attempts SET audio_url = '' WHERE id = ?", attemptId);
        mvc.perform(get("/api/attempts/{id}/download-url", attemptId).with(as(owner)))
                .andExpect(status().isNotFound());
    }

    private UUID user() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO users (id, email, username, native_language) VALUES (?, ?, ?, 'ko')", id, id + "@test.example.com", "u" + id.toString().substring(0, 8));
        return id;
    }

    private static RequestPostProcessor as(UUID id) {
        return authentication(new UsernamePasswordAuthenticationToken(id, null, List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }
}
