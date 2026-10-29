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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Exercises the existing API and security filters against PostgreSQL and real migrations. */
class StudyCardPracticeIntegrationTest extends PostgresIntegrationTest {

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;

    MockMvc mvc;
    UUID owner;
    UUID friend;
    UUID outsider;
    UUID sessionId;
    UUID cardId;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        owner = insertUser();
        friend = insertUser();
        outsider = insertUser();
        sessionId = UUID.randomUUID();
        cardId = UUID.randomUUID();
        jdbc.update("INSERT INTO study_sessions (id, created_by) VALUES (?, ?)", sessionId, owner);
        jdbc.update("INSERT INTO session_members (session_id, user_id) VALUES (?, ?)", sessionId, owner);
        jdbc.update("INSERT INTO study_cards (id, session_id, created_by_user_id, phrase) VALUES (?, ?, ?, '안녕하세요')",
                cardId, sessionId, owner);
    }

    @Test
    void creatorCanPractisePersonalCardRepeatedlyUsingExistingPayload() throws Exception {
        submit(owner, "practice/first.m4a");
        submit(owner, "practice/retry.webm");
        // Pilot collection is opt-in; the default application must not collect raw activity.
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM learning_activity WHERE card_id = ?", Long.class, cardId)).isZero();

        mvc.perform(get("/api/cards/{id}/attempts", cardId).with(as(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
        assertThat(jdbc.queryForList("SELECT learner_id FROM learner_attempts WHERE card_id = ?", UUID.class, cardId))
                .containsExactly(owner, owner);
        assertThat(jdbc.queryForObject("SELECT COUNT(DISTINCT id) FROM learner_attempts WHERE card_id = ?", Integer.class, cardId))
                .isEqualTo(2);
        assertThat(jdbc.queryForList("SELECT audio_url FROM learner_attempts WHERE card_id = ?", String.class, cardId))
                .containsExactlyInAnyOrder("practice/first.m4a", "practice/retry.webm");
    }

    @Test
    void participantsCanExchangeExamplesAttemptsAndFeedbackWithoutChangingCardOwner() throws Exception {
        join(friend);
        for (UUID participant : List.of(friend, owner)) {
            mvc.perform(post("/api/cards/{id}/native-audios", cardId).with(as(participant))
                            .contentType(MediaType.APPLICATION_JSON).content("{\"audioKey\":\"example/reference.m4a\"}"))
                    .andExpect(status().isCreated());
            submit(participant, "practice/" + participant + ".m4a");
        }
        UUID ownerAttempt = attemptId(owner);
        UUID friendAttempt = attemptId(friend);

        correct(friend, ownerAttempt, "5");
        correct(owner, friendAttempt, "null");

        assertThat(jdbc.queryForObject("SELECT learner_id FROM learner_attempts WHERE id = ?", UUID.class, ownerAttempt))
                .isEqualTo(owner);
        assertThat(jdbc.queryForObject("SELECT score FROM learner_attempts WHERE id = ?", Integer.class, ownerAttempt))
                .isEqualTo(5);
        assertThat(jdbc.queryForObject("SELECT score FROM learner_attempts WHERE id = ?", Integer.class, friendAttempt))
                .isNull();
        assertThat(jdbc.queryForObject("SELECT created_by_user_id FROM study_cards WHERE id = ?", UUID.class, cardId))
                .isEqualTo(owner);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM credit_transactions WHERE user_id IN (?, ?)", Integer.class, owner, friend))
                .isZero();
    }

    @Test
    void personalPracticeNotesRemainAvailableToTheLearner() throws Exception {
        submit(owner, "practice/self.m4a");
        correct(owner, attemptId(owner), "null");
    }

    @Test
    void nonMemberCannotReadPractiseAddExamplesOrCorrect() throws Exception {
        submit(owner, "practice/owner.m4a");
        UUID attemptId = attemptId(owner);
        mvc.perform(get("/api/cards/{id}/attempts", cardId).with(as(outsider)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/cards/{id}/attempts", cardId).with(as(outsider))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"audioKey\":\"other.m4a\"}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("SESSION_002"));
        mvc.perform(post("/api/cards/{id}/native-audios", cardId).with(as(outsider))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"audioKey\":\"other.m4a\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/attempts/{id}/correction", attemptId).with(as(outsider))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"correctionNote\":\"not allowed\",\"score\":5}"))
                .andExpect(status().isForbidden());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM learner_attempts WHERE card_id = ?", Integer.class, cardId))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT correction_note FROM learner_attempts WHERE id = ?", String.class, attemptId))
                .isNull();
    }

    @Test
    void creatorWhoIsNoLongerAMemberCannotPractise() throws Exception {
        jdbc.update("DELETE FROM session_members WHERE session_id = ? AND user_id = ?", sessionId, owner);
        mvc.perform(post("/api/cards/{id}/attempts", cardId).with(as(owner))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"audioKey\":\"revoked.m4a\"}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("SESSION_002"));
    }

    @Test
    void practiceDoesNotGrantCardManagementRights() throws Exception {
        join(friend);
        submit(friend, "practice/friend.m4a");
        mvc.perform(patch("/api/cards/{id}", cardId).with(as(friend))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"phrase\":\"changed\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/cards/{id}/move", cardId).with(as(friend))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetSessionId\":\"" + sessionId + "\",\"position\":0}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/cards/{id}", cardId).with(as(friend)))
                .andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/cards/{id}", cardId).with(as(owner))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"phrase\":\"こんにちは\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.phrase").value("こんにちは"));
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 6, 80})
    void scoreOutsideFivePointScaleIsRejected(int score) throws Exception {
        submit(owner, "practice/score.m4a");
        UUID attemptId = attemptId(owner);
        mvc.perform(patch("/api/attempts/{id}/correction", attemptId).with(as(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"correctionNote\":\"feedback\",\"score\":" + score + "}"))
                .andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT score FROM learner_attempts WHERE id = ?", Integer.class, attemptId)).isNull();
    }

    @Test
    void unauthenticatedPracticeIsRejected() throws Exception {
        mvc.perform(post("/api/cards/{id}/attempts", cardId)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"audioKey\":\"anonymous.m4a\"}"))
                .andExpect(status().isUnauthorized());
    }

    private void submit(UUID learner, String audioKey) throws Exception {
        mvc.perform(post("/api/cards/{id}/attempts", cardId).with(as(learner))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"audioKey\":\"" + audioKey + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.learnerId").value(learner.toString()))
                .andExpect(jsonPath("$.audioUrl").value(audioKey));
    }

    private void correct(UUID reviewer, UUID attemptId, String score) throws Exception {
        mvc.perform(patch("/api/attempts/{id}/correction", attemptId).with(as(reviewer))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"correctionNote\":\"한 번 더 연습해 봐요\",\"score\":" + score + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.correctionNote").value("한 번 더 연습해 봐요"));
    }

    private UUID attemptId(UUID learner) {
        return jdbc.queryForObject("SELECT id FROM learner_attempts WHERE card_id = ? AND learner_id = ?", UUID.class, cardId, learner);
    }

    private void join(UUID user) {
        jdbc.update("INSERT INTO session_members (session_id, user_id) VALUES (?, ?)", sessionId, user);
    }

    private UUID insertUser() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO users (id, email, username, native_language) VALUES (?, ?, ?, 'ko')",
                id, id + "@test.example.com", "u" + id.toString().substring(0, 8));
        return id;
    }

    private static RequestPostProcessor as(UUID user) {
        return authentication(new UsernamePasswordAuthenticationToken(user, null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }
}
