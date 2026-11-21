package me.yeonjae.tonebridge.adapter.in.web;

import me.yeonjae.tonebridge.shared.exception.ErrorCode;
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
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * A friend giving feedback on a practice attempt can point at up to three sounds from the reviewed
 * pronunciation-guide catalogue. Runs through the real security filters, PostgreSQL and migrations.
 */
class AttemptSoundTargetIntegrationTest extends PostgresIntegrationTest {

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;

    MockMvc mvc;
    UUID learner;
    UUID friend;
    UUID outsider;
    UUID sessionId;
    UUID cardId;
    UUID attemptId;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        learner = insertUser();
        friend = insertUser();
        outsider = insertUser();
        sessionId = UUID.randomUUID();
        cardId = UUID.randomUUID();
        attemptId = UUID.randomUUID();
        jdbc.update("INSERT INTO study_sessions (id, created_by) VALUES (?, ?)", sessionId, learner);
        jdbc.update("INSERT INTO session_members (session_id, user_id) VALUES (?, ?), (?, ?)", sessionId, learner, sessionId, friend);
        jdbc.update("INSERT INTO study_cards (id, session_id, created_by_user_id, phrase) VALUES (?, ?, ?, 'think')", cardId, sessionId, learner);
        jdbc.update("INSERT INTO learner_attempts (id, card_id, learner_id, audio_url) VALUES (?, ?, ?, 'practice/one.webm')", attemptId, cardId, learner);
    }

    @Test
    void feedbackCanPointAtSoundsAndEveryAttemptViewReturnsThemInOrder() throws Exception {
        feedback(friend, """
                {"correctionNote":"th 가 s 처럼 들려요","score":3,"soundTargets":[{"guideId":"en-th"},{"guideId":"ko-rieul"}]}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.soundTargets.length()").value(2))
                .andExpect(jsonPath("$.soundTargets[0].guideId").value("en-th"))
                .andExpect(jsonPath("$.soundTargets[1].guideId").value("ko-rieul"));

        mvc.perform(get("/api/cards/{id}/attempts", cardId).with(as(learner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].soundTargets[0].guideId").value("en-th"))
                .andExpect(jsonPath("$[0].soundTargets[1].guideId").value("ko-rieul"));
        mvc.perform(get("/api/sessions/{id}/cards", sessionId).with(as(learner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].latestAttempt.soundTargets.length()").value(2));
    }

    @Test
    void omittingSoundTargetsKeepsThemSoOlderClientsDoNotEraseThem_andAnEmptyListClearsThem() throws Exception {
        feedback(friend, "{\"correctionNote\":\"first\",\"soundTargets\":[{\"guideId\":\"en-r\"}]}").andExpect(status().isOk());

        // The mobile app sends only {correctionNote, score}.
        feedback(friend, "{\"correctionNote\":\"edited on mobile\",\"score\":4}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.correctionNote").value("edited on mobile"))
                .andExpect(jsonPath("$.soundTargets[0].guideId").value("en-r"));

        feedback(friend, "{\"correctionNote\":\"no sound this time\",\"soundTargets\":[]}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.soundTargets.length()").value(0));
        assertThat(storedTargets()).isEmpty();
    }

    @Test
    void attemptsWithoutFeedbackReportAnEmptyList() throws Exception {
        mvc.perform(get("/api/cards/{id}/attempts", cardId).with(as(learner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].soundTargets.length()").value(0));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "[{\"guideId\":\"en-x\"}]",
            "[{\"guideId\":\"<script>\"}]",
            "[{\"guideId\":\"en-th\"},{\"guideId\":\"en-th\"}]",
            "[{\"guideId\":\"en-th\"},{\"guideId\":\"en-r\"},{\"guideId\":\"en-l\"},{\"guideId\":\"ko-rieul\"}]",
            "[{\"guideId\":\"\"}]",
            "[{}]",
            "[null]"
    })
    void soundTargetsOutsideTheCatalogueOrLimitsAreRefusedAndChangeNothing(String targets) throws Exception {
        feedback(friend, "{\"correctionNote\":\"kept\",\"soundTargets\":[{\"guideId\":\"en-l\"}]}").andExpect(status().isOk());

        feedback(friend, "{\"correctionNote\":\"should not be saved\",\"soundTargets\":" + targets + "}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCode.INVALID_INPUT.getCode()));

        assertThat(jdbc.queryForObject("SELECT correction_note FROM learner_attempts WHERE id = ?", String.class, attemptId))
                .isEqualTo("kept");
        assertThat(storedTargets()).containsExactly("en-l");
    }

    @Test
    void onlyMembersOfTheNotebookCanAttachSounds() throws Exception {
        feedback(outsider, "{\"correctionNote\":\"x\",\"soundTargets\":[{\"guideId\":\"en-th\"}]}")
                .andExpect(status().isForbidden());
        assertThat(storedTargets()).isEmpty();
    }

    @Test
    void concurrentFeedbackSavesDoNotCollideAndLeaveOneConsistentSet() throws Exception {
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<Integer> save = () -> {
                start.await();
                return feedback(friend, "{\"correctionNote\":\"race\",\"soundTargets\":[{\"guideId\":\"en-th\"},{\"guideId\":\"en-r\"}]}")
                        .andReturn().getResponse().getStatus();
            };
            var a = executor.submit(save);
            var b = executor.submit(save);
            start.countDown();
            assertThat(List.of(a.get(15, TimeUnit.SECONDS), b.get(15, TimeUnit.SECONDS))).containsOnly(200);
        }
        assertThat(storedTargets()).containsExactly("en-th", "en-r");
    }

    private org.springframework.test.web.servlet.ResultActions feedback(UUID reviewer, String body) throws Exception {
        return mvc.perform(patch("/api/attempts/{id}/correction", attemptId).with(as(reviewer))
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private List<String> storedTargets() {
        return jdbc.queryForList("SELECT guide_id FROM attempt_sound_targets WHERE attempt_id = ? ORDER BY position",
                String.class, attemptId);
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
