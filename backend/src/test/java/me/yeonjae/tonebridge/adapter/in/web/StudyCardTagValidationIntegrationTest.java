package me.yeonjae.tonebridge.adapter.in.web;

import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.support.PostgresIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.json.JsonMapper;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Card tags are stored joined by commas in one VARCHAR(500) column. These tests pin the request
 * limits to that storage, through the real security filters and PostgreSQL schema, so an oversized
 * request is refused as invalid input instead of failing at the database.
 */
class StudyCardTagValidationIntegrationTest extends PostgresIntegrationTest {

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final int MAX_TAGS = 20;
    private static final int MAX_TAG_LENGTH = 24;

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;

    MockMvc mvc;
    UUID owner;
    UUID sessionId;
    UUID cardId;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        owner = UUID.randomUUID();
        jdbc.update("INSERT INTO users (id, email, username, native_language) VALUES (?, ?, ?, 'ko')",
                owner, owner + "@test.example.com", "u" + owner.toString().substring(0, 8));
        sessionId = UUID.randomUUID();
        cardId = UUID.randomUUID();
        jdbc.update("INSERT INTO study_sessions (id, created_by) VALUES (?, ?)", sessionId, owner);
        jdbc.update("INSERT INTO session_members (session_id, user_id) VALUES (?, ?)", sessionId, owner);
        jdbc.update("INSERT INTO study_cards (id, session_id, created_by_user_id, phrase, tags) VALUES (?, ?, ?, '안녕하세요', '발음')",
                cardId, sessionId, owner);
    }

    static Stream<List<String>> invalidTags() {
        return Stream.of(
                IntStream.rangeClosed(1, MAX_TAGS + 1).mapToObj(i -> "t" + i).toList(),
                List.of("가".repeat(MAX_TAG_LENGTH + 1)),
                List.of("발음", " "),
                // A comma inside one tag would come back as two tags, because tags are stored comma-joined.
                List.of("th,r"));
    }

    @ParameterizedTest
    @MethodSource("invalidTags")
    void creatingACardWithTagsOutsideTheLimitsIsRefusedAsInvalidInput(List<String> tags) throws Exception {
        mvc.perform(post("/api/sessions/{id}/cards", sessionId).with(as(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(body(tags)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCode.INVALID_INPUT.getCode()));

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM study_cards WHERE session_id = ?", Integer.class, sessionId))
                .isEqualTo(1);
    }

    @ParameterizedTest
    @MethodSource("invalidTags")
    void editingACardWithTagsOutsideTheLimitsIsRefusedAndKeepsTheStoredTags(List<String> tags) throws Exception {
        mvc.perform(patch("/api/cards/{id}", cardId).with(as(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(body(tags)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCode.INVALID_INPUT.getCode()));

        assertThat(jdbc.queryForObject("SELECT tags FROM study_cards WHERE id = ?", String.class, cardId)).isEqualTo("발음");
    }

    @Test
    void theLargestAllowedTagSetFitsTheColumnOnCreateAndEdit() throws Exception {
        List<String> largest = IntStream.range(0, MAX_TAGS)
                .mapToObj(i -> String.format("%02d", i) + "가".repeat(MAX_TAG_LENGTH - 2)).toList();

        mvc.perform(post("/api/sessions/{id}/cards", sessionId).with(as(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(body(largest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tags.length()").value(MAX_TAGS));
        mvc.perform(patch("/api/cards/{id}", cardId).with(as(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(body(largest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tags.length()").value(MAX_TAGS));
    }

    @Test
    void cardsMayStillBeSavedWithoutTags() throws Exception {
        mvc.perform(post("/api/sessions/{id}/cards", sessionId).with(as(owner))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"phrase\":\"태그 없음\",\"context\":null}"))
                .andExpect(status().isCreated());
        mvc.perform(patch("/api/cards/{id}", cardId).with(as(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(body(Collections.emptyList())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tags.length()").value(0));
    }

    private static String body(List<String> tags) {
        return JSON.writeValueAsString(Map.of("phrase", "검증 대상 표현", "tags", tags));
    }

    private static RequestPostProcessor as(UUID user) {
        return authentication(new UsernamePasswordAuthenticationToken(user, null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }
}
