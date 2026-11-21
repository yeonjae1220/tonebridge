package me.yeonjae.tonebridge.adapter.in.web;

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

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The learner's feedback list (home preview and the feedback page) carries the sounds each note points at. */
class PracticeFeedbackSoundTargetIntegrationTest extends PostgresIntegrationTest {

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;

    MockMvc mvc;
    UUID learner;
    UUID friend;
    UUID pointed;
    UUID plain;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        learner = insertUser();
        friend = insertUser();
        UUID session = UUID.randomUUID();
        UUID card = UUID.randomUUID();
        pointed = UUID.randomUUID();
        plain = UUID.randomUUID();
        jdbc.update("INSERT INTO study_sessions (id, created_by) VALUES (?, ?)", session, learner);
        jdbc.update("INSERT INTO session_members (session_id, user_id) VALUES (?, ?), (?, ?)", session, learner, session, friend);
        jdbc.update("INSERT INTO study_cards (id, session_id, created_by_user_id, phrase) VALUES (?, ?, ?, 'think')", card, session, learner);
        jdbc.update("INSERT INTO learner_attempts (id, card_id, learner_id, audio_url, attempted_at) VALUES (?, ?, ?, 'a.webm', now() - interval '2 hours'), (?, ?, ?, 'b.webm', now() - interval '1 hour')",
                pointed, card, learner, plain, card, learner);
    }

    @Test
    void feedbackListReturnsEachNotesSoundsInOrderAndAnEmptyListOtherwise() throws Exception {
        feedback(pointed, "{\"correctionNote\":\"th 가 s 처럼 들려요\",\"soundTargets\":[{\"guideId\":\"en-th\"},{\"guideId\":\"ko-rieul\"}]}");
        feedback(plain, "{\"correctionNote\":\"좋아요\"}");

        mvc.perform(get("/api/practice-feedback").with(as(learner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[?(@.attemptId=='" + pointed + "')].soundTargets[0].guideId").value("en-th"))
                .andExpect(jsonPath("$.items[?(@.attemptId=='" + pointed + "')].soundTargets[1].guideId").value("ko-rieul"))
                .andExpect(jsonPath("$.items[?(@.attemptId=='" + plain + "')].soundTargets.length()").value(0));
    }

    private void feedback(UUID attempt, String body) throws Exception {
        mvc.perform(patch("/api/attempts/{id}/correction", attempt).with(as(friend))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
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
