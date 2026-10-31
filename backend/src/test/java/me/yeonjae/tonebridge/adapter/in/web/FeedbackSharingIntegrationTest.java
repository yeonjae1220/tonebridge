package me.yeonjae.tonebridge.adapter.in.web;

import me.yeonjae.tonebridge.support.PostgresIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class FeedbackSharingIntegrationTest extends PostgresIntegrationTest {
    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    MockMvc mvc;
    UUID owner, friend, outsider, session, card, attempt;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        owner = user(); friend = user(); outsider = user();
        session = notebook(owner, friend);
        card = card(session);
        attempt = attempt(card, owner, "legacy feedback");
        jdbc.update("INSERT INTO friend_requests (id, sender_id, receiver_id, status) VALUES (?, ?, ?, 'ACCEPTED')",
                UUID.randomUUID(), owner, friend);
    }

    @Test
    void includesOlderAttemptsAndNotebooksAndPaginatesWithoutExposingAudioKeys() throws Exception {
        // Later uncorrected attempts must not hide older feedback.
        attempt(card, owner, null);
        for (int i = 0; i < 6; i++) attempt(card(notebook(owner, friend)), owner, "other notebook " + i);
        attempt(card, friend, "not mine");
        mvc.perform(get("/api/practice-feedback?size=5").with(as(owner)))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.items.length()").value(5))
                .andExpect(jsonPath("$.nextPage").value(1))
                .andExpect(jsonPath("$.items[0].audioUrl").doesNotExist());
        mvc.perform(get("/api/practice-feedback?size=5&page=1").with(as(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[1].attemptId").value(attempt.toString()))
                .andExpect(jsonPath("$.items[1].correctionAuthorId").isEmpty())
                .andExpect(jsonPath("$.items[1].correctionUpdatedAt").isEmpty())
                .andExpect(jsonPath("$.nextPage").isEmpty());
        mvc.perform(get("/api/practice-feedback").with(as(outsider)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
    }

    @Test
    void editingOlderFeedbackRecordsRealAuthorTimeAndMovesItToTop() throws Exception {
        attempt(card, owner, "newer practice");
        mvc.perform(patch("/api/attempts/{id}/correction", attempt).with(as(friend))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"correctionNote\":\"updated\",\"score\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.correctionAuthorId").value(friend.toString()))
                .andExpect(jsonPath("$.correctionUpdatedAt").isNotEmpty());
        mvc.perform(get("/api/practice-feedback").with(as(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].attemptId").value(attempt.toString()))
                .andExpect(jsonPath("$.items[0].correctionNote").value("updated"))
                .andExpect(jsonPath("$.items[0].correctionAuthorName").isNotEmpty());
    }

    @Test
    void collectionBoundsTextButTheOriginalFeedbackRemainsIntact() throws Exception {
        String longNote = "a".repeat(1200);
        jdbc.update("UPDATE learner_attempts SET correction_note = ? WHERE id = ?", longNote, attempt);
        mvc.perform(get("/api/practice-feedback").with(as(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].correctionNote").value("a".repeat(500)));
        mvc.perform(get("/api/cards/{id}/attempts", card).with(as(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].correctionNote").value(longNote));
    }

    @Test
    void enforcesAuthenticationBoundsAndCurrentParents() throws Exception {
        mvc.perform(get("/api/practice-feedback")).andExpect(status().isUnauthorized());
        for (String query : List.of("size=0", "size=51", "page=-1", "page=10001"))
            mvc.perform(get("/api/practice-feedback?" + query).with(as(owner))).andExpect(status().isBadRequest());
        jdbc.update("UPDATE study_cards SET deleted_at = NOW() WHERE id = ?", card);
        mvc.perform(get("/api/practice-feedback").with(as(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
        jdbc.update("UPDATE study_cards SET deleted_at = NULL WHERE id = ?", card);
        jdbc.update("UPDATE study_sessions SET deleted_at = NOW() WHERE id = ?", session);
        mvc.perform(get("/api/practice-feedback").with(as(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void leavingRevokesOnlyTheLeaverAndPreservesLearningRecords(boolean creatorLeaves) throws Exception {
        UUID leaver = creatorLeaves ? owner : friend;
        UUID remaining = creatorLeaves ? friend : owner;
        mvc.perform(delete("/api/sessions/{id}/membership", session).with(as(leaver))).andExpect(status().isNoContent());
        denied(leaver);
        mvc.perform(get("/api/sessions/{id}", session).with(as(remaining))).andExpect(status().isOk());
        mvc.perform(get("/api/cards/{id}", card).with(as(remaining))).andExpect(status().isOk());
        mvc.perform(get("/api/practice-feedback").with(as(leaver)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
        assertRecordsRemain();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM friend_requests WHERE sender_id = ? AND receiver_id = ?", Integer.class, owner, friend)).isEqualTo(1);
        mvc.perform(delete("/api/sessions/{id}/membership", session).with(as(remaining))).andExpect(status().isNoContent());
        denied(remaining);
        assertRecordsRemain();
    }

    @Test
    void legacyFriendRemovalKeepsSharing() throws Exception {
        mvc.perform(delete("/api/friends/{id}", friend).with(as(owner))).andExpect(status().isNoContent());
        mvc.perform(get("/api/cards/{id}", card).with(as(owner))).andExpect(status().isOk());
        mvc.perform(get("/api/cards/{id}", card).with(as(friend))).andExpect(status().isOk());
        assertRecordsRemain();
    }

    @Test
    void explicitClosureRevokesBothUsersAcrossTheirSharedNotebooksOnly() throws Exception {
        UUID second = notebook(owner, friend);
        UUID unrelated = notebook(owner, outsider);
        mvc.perform(delete("/api/friends/{id}?closeShared=true", friend).with(as(owner))).andExpect(status().isNoContent());
        denied(owner); denied(friend);
        for (UUID user : List.of(owner, friend)) {
            mvc.perform(get("/api/sessions/{id}", second).with(as(user))).andExpect(status().isForbidden());
            mvc.perform(get("/api/practice-feedback").with(as(user))).andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
        }
        mvc.perform(get("/api/sessions/{id}", unrelated).with(as(owner))).andExpect(status().isOk());
        assertRecordsRemain();
        // Re-friending never resurrects the former memberships.
        jdbc.update("INSERT INTO friend_requests (id, sender_id, receiver_id, status) VALUES (?, ?, ?, 'ACCEPTED')",
                UUID.randomUUID(), owner, friend);
        mvc.perform(post("/api/sessions").with(as(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"friendId\":\"" + friend + "\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(org.hamcrest.Matchers.not(session.toString())));
        denied(owner);
    }

    @Test
    void outsidersCannotLeaveOrCloseOtherUsersSharing() throws Exception {
        mvc.perform(delete("/api/sessions/{id}/membership", session).with(as(outsider))).andExpect(status().isForbidden());
        mvc.perform(delete("/api/friends/{id}?closeShared=true", friend).with(as(outsider))).andExpect(status().isNotFound());
        mvc.perform(get("/api/cards/{id}", card).with(as(owner))).andExpect(status().isOk());
        assertRecordsRemain();
    }

    @Test
    void concurrentCreationAndFriendClosureCannotLeaveAnAccessibleSharedNotebook() throws Exception {
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var create = executor.submit(() -> {
                start.await();
                return mvc.perform(post("/api/sessions").with(as(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"friendId\":\"" + friend + "\",\"title\":\"racing creation\"}"))
                        .andReturn().getResponse().getStatus();
            });
            var close = executor.submit(() -> {
                start.await();
                return mvc.perform(delete("/api/friends/{id}?closeShared=true", friend).with(as(owner)))
                        .andReturn().getResponse().getStatus();
            });
            start.countDown();
            assertThat(create.get(15, TimeUnit.SECONDS)).isIn(201, 403);
            assertThat(close.get(15, TimeUnit.SECONDS)).isEqualTo(204);
        }
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM session_members a JOIN session_members b ON a.session_id = b.session_id
                WHERE a.user_id = ? AND b.user_id = ?
                """, Integer.class, owner, friend)).isZero();
    }

    private void denied(UUID user) throws Exception {
        mvc.perform(get("/api/cards/{id}", card).with(as(user))).andExpect(status().isForbidden());
        mvc.perform(get("/api/attempts/{id}/download-url", attempt).with(as(user))).andExpect(status().isForbidden());
        mvc.perform(post("/api/cards/{id}/attempts", card).with(as(user)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"audioKey\":\"existing.webm\"}")).andExpect(status().isForbidden());
        mvc.perform(patch("/api/attempts/{id}/correction", attempt).with(as(user)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"correctionNote\":\"not allowed\"}")).andExpect(status().isForbidden());
        mvc.perform(patch("/api/sessions/{id}", session).with(as(user)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"not allowed\"}")).andExpect(status().isForbidden());
        mvc.perform(delete("/api/sessions/{id}", session).with(as(user))).andExpect(status().isForbidden());
    }

    private void assertRecordsRemain() {
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM learner_attempts WHERE id = ?", Integer.class, attempt)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM study_cards WHERE id = ? AND deleted_at IS NULL", Integer.class, card)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM study_sessions WHERE id = ? AND deleted_at IS NULL", Integer.class, session)).isEqualTo(1);
    }
    private UUID user() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO users (id,email,username,native_language) VALUES (?, ?, ?, 'ko')", id, id + "@test.example", "u" + id.toString().substring(0,8));
        return id;
    }
    private UUID notebook(UUID first, UUID second) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO study_sessions (id,created_by) VALUES (?, ?)", id, first);
        for (UUID user : List.of(first, second)) jdbc.update("INSERT INTO session_members (session_id,user_id) VALUES (?, ?)", id, user);
        return id;
    }
    private UUID card(UUID notebook) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO study_cards (id,session_id,created_by_user_id,phrase) VALUES (?, ?, ?, 'hello')", id, notebook, owner);
        return id;
    }
    private UUID attempt(UUID cardId, UUID learner, String feedback) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO learner_attempts (id,card_id,learner_id,audio_url,correction_note) VALUES (?, ?, ?, 'existing.webm', ?)", id, cardId, learner, feedback);
        return id;
    }
    private static RequestPostProcessor as(UUID user) {
        return authentication(new UsernamePasswordAuthenticationToken(user, null, List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }
}
