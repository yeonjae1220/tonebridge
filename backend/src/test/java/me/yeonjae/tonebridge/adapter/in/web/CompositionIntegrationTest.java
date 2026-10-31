package me.yeonjae.tonebridge.adapter.in.web;

import me.yeonjae.tonebridge.support.PostgresIntegrationTest;
import me.yeonjae.tonebridge.application.port.out.StoragePort;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import me.yeonjae.tonebridge.application.port.out.CardNativeAudioPort;
import me.yeonjae.tonebridge.application.port.out.FcmNotificationPort;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class CompositionIntegrationTest extends PostgresIntegrationTest {
    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean StoragePort storage;
    @MockitoBean FcmNotificationPort notifications;
    @MockitoSpyBean CardNativeAudioPort nativeAudios;
    MockMvc mvc;
    UUID owner, friend, operation;
    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        owner = user(); friend = user(); operation = UUID.randomUUID();
        jdbc.update("INSERT INTO friend_requests(sender_id, receiver_id, status) VALUES (?, ?, 'ACCEPTED')", owner, friend);
        when(storage.presignUploadKey(anyString(), anyString(), any())).thenAnswer(invocation ->
                new StoragePort.PresignedUpload("https://storage.invalid/upload", invocation.getArgument(0)));
        when(storage.hasValidAudio(anyString(), anyString())).thenReturn(true);
    }
    @ParameterizedTest
    @CsvSource({"PERSONAL,TEXT", "PERSONAL,AUDIO", "FRIEND,TEXT", "FRIEND,AUDIO", "COMMUNITY,TEXT", "COMMUNITY,AUDIO"})
    void concurrentAndLostResponseRetriesCreateExactlyOneComposition(String destination, String kind) throws Exception {
        if (kind.equals("AUDIO")) upload(owner, operation);
        String body = body(destination, kind);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<String> save = () -> { start.await(); return save(owner, operation, body, 200); };
            var a = executor.submit(save); var b = executor.submit(save); start.countDown();
            String first = a.get(15, TimeUnit.SECONDS);
            assertThat(b.get(15, TimeUnit.SECONDS)).isEqualTo(first);
            assertThat(save.call()).isEqualTo(first);
            mvc.perform(get("/api/compositions/{id}", operation).with(as(owner)))
                    .andExpect(status().isOk()).andExpect(content().json(first));
        }
        assertThat(count("study_sessions", "created_by", owner)).isEqualTo(destination.equals("COMMUNITY") ? 0 : 1);
        assertThat(count("study_cards", "created_by_user_id", owner)).isEqualTo(destination.equals("COMMUNITY") ? 0 : 1);
        assertThat(count("correction_requests", "requester_id", owner)).isEqualTo(destination.equals("COMMUNITY") ? 1 : 0);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM card_native_audio a JOIN study_cards c ON a.card_id=c.id WHERE c.created_by_user_id=?",
                Integer.class, owner)).isEqualTo(!destination.equals("COMMUNITY") && kind.equals("AUDIO") ? 1 : 0);
        save(owner, operation, body.replace("Hello", "Changed"), 409);
    }
    @Test void uploadFailureCreatesNothingAndRetryUsesSameKey() throws Exception {
        String first = upload(owner, operation);
        when(storage.hasValidAudio(anyString(), anyString())).thenReturn(false);
        save(owner, operation, body("PERSONAL", "AUDIO"), 404);
        assertThat(count("study_sessions", "created_by", owner)).isZero();
        assertThat(count("study_cards", "created_by_user_id", owner)).isZero();
        assertThat(upload(owner, operation)).isEqualTo(first);
        when(storage.hasValidAudio(anyString(), anyString())).thenReturn(true);
        save(owner, operation, body("PERSONAL", "AUDIO"), 200);
        assertThat(count("study_cards", "created_by_user_id", owner)).isEqualTo(1);
    }
    @Test void failureAfterCreatingNotebookRollsEverythingBackThenSameOperationCanSucceed() throws Exception {
        // Phrase validation occurs after choosing/creating a notebook: its insert
        // must roll back too, rather than leave a partial notebook on every retry.
        String invalid = body("PERSONAL", "TEXT").replace("Hello", "x".repeat(501));
        save(owner, operation, invalid, 400);
        assertThat(count("study_sessions", "created_by", owner)).isZero();
        assertThat(count("composition_receipts", "owner_id", owner)).isZero();
        save(owner, operation, body("PERSONAL", "TEXT"), 200);
        assertThat(count("study_sessions", "created_by", owner)).isEqualTo(1);
    }
    @Test void differentConcurrentOperationsReuseTheFirstNotebook() throws Exception {
        try (var executor = Executors.newFixedThreadPool(2)) {
            var a = executor.submit(() -> save(owner, UUID.randomUUID(), body("PERSONAL", "TEXT"), 200));
            var b = executor.submit(() -> save(owner, UUID.randomUUID(), body("PERSONAL", "TEXT"), 200));
            a.get(15, TimeUnit.SECONDS); b.get(15, TimeUnit.SECONDS);
        }
        assertThat(count("study_sessions", "created_by", owner)).isEqualTo(1);
        assertThat(count("study_cards", "created_by_user_id", owner)).isEqualTo(2);
    }
    @Test void failureAttachingAudioRollsBackCardAndNotebookWithoutSendingNotification() throws Exception {
        upload(owner, operation);
        doThrow(new IllegalStateException("injected attachment failure")).doCallRealMethod().when(nativeAudios).save(any());
        save(owner, operation, body("FRIEND", "AUDIO"), 500);
        assertThat(count("study_sessions", "created_by", owner)).isZero();
        assertThat(count("study_cards", "created_by_user_id", owner)).isZero();
        verifyNoInteractions(notifications);
        save(owner, operation, body("FRIEND", "AUDIO"), 200);
        save(owner, operation, body("FRIEND", "AUDIO"), 200);
        assertThat(count("study_cards", "created_by_user_id", owner)).isEqualTo(1);
        verify(notifications, times(1)).sendNewStudyCard(eq(friend), any(), anyString());
    }
    @Test void cancelBeforeSaveBlocksLateRequestsAndCancelAfterSaveReturnsExistingResult() throws Exception {
        upload(owner, operation);
        mvc.perform(post("/api/compositions/{id}/cancel", operation).with(as(owner))).andExpect(status().isNoContent());
        save(owner, operation, body("PERSONAL", "AUDIO"), 409);
        mvc.perform(post("/api/compositions/{id}/upload-url", operation).with(as(owner)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"contentType\":\"audio/webm\"}")).andExpect(status().isConflict());
        operation = UUID.randomUUID();
        String result = save(owner, operation, body("PERSONAL", "TEXT"), 200);
        mvc.perform(post("/api/compositions/{id}/cancel", operation).with(as(owner)))
                .andExpect(status().isOk()).andExpect(content().json(result));
    }
    @Test void accountScopeMembershipAndDeletionStillApplyToReplays() throws Exception {
        String result = save(owner, operation, body("FRIEND", "TEXT"), 200);
        mvc.perform(get("/api/compositions/{id}", operation).with(as(friend))).andExpect(status().isNotFound());
        mvc.perform(get("/api/compositions/{id}", operation)).andExpect(status().isUnauthorized());
        var json = tools.jackson.databind.json.JsonMapper.builder().build().readTree(result);
        UUID sessionId = UUID.fromString(json.get("sessionId").asText());
        jdbc.update("DELETE FROM session_members WHERE session_id=? AND user_id=?", sessionId, owner);
        save(owner, operation, body("FRIEND", "TEXT"), 403);
        jdbc.update("INSERT INTO session_members(session_id,user_id) VALUES (?,?)", sessionId, owner);
        jdbc.update("UPDATE study_cards SET deleted_at=NOW() WHERE session_id=?", sessionId);
        save(owner, operation, body("FRIEND", "TEXT"), 409);
        mvc.perform(post("/api/compositions/{id}/cancel", operation).with(as(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.type").value("unavailable"))
                .andExpect(jsonPath("$.cardId").isEmpty());
        assertThat(count("study_cards", "created_by_user_id", owner)).isEqualTo(1);
        save(friend, operation, body("PERSONAL", "TEXT"), 200);
    }
    @Test void invalidMimeForeignFriendAndMissingFieldsAreRejectedBeforeCreation() throws Exception {
        mvc.perform(post("/api/compositions/{id}/upload-url", operation).with(as(owner)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"contentType\":\"text/html\"}")).andExpect(status().isBadRequest());
        save(owner, operation, "{}", 400);
        jdbc.update("DELETE FROM friend_requests WHERE sender_id=?", owner);
        save(owner, operation, body("FRIEND", "TEXT"), 403);
        assertThat(count("study_sessions", "created_by", owner)).isZero();
    }
    private String body(String destination, String kind) {
        return """
                {"kind":"%s","destination":"%s","friendId":"%s","title":"Practice",
                 "contentText":"Hello","context":"Example","audioTitle":"Audio",
                 "targetLanguage":"en","goals":["pronunciation"]}
                """.formatted(kind, destination, friend);
    }
    private String upload(UUID user, UUID id) throws Exception {
        return mvc.perform(post("/api/compositions/{id}/upload-url", id).with(as(user)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"contentType\":\"audio/webm\"}")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }
    private String save(UUID user, UUID id, String body, int status) throws Exception {
        return mvc.perform(post("/api/compositions/{id}", id).with(as(user)).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().is(status)).andReturn().getResponse().getContentAsString();
    }
    private int count(String table, String column, UUID id) {
        return jdbc.queryForObject("SELECT count(*) FROM " + table + " WHERE " + column + "=?", Integer.class, id);
    }
    private UUID user() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO users(id,email,username,native_language) VALUES (?,?,?,'ko')", id, id + "@test.invalid", "u" + id.toString().substring(0,8));
        return id;
    }
    private static RequestPostProcessor as(UUID user) {
        return authentication(new UsernamePasswordAuthenticationToken(user, null, List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }
}
