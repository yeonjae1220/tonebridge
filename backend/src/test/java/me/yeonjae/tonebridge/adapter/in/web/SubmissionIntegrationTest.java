package me.yeonjae.tonebridge.adapter.in.web;

import me.yeonjae.tonebridge.support.PostgresIntegrationTest;
import me.yeonjae.tonebridge.application.port.out.SubmissionPort;
import me.yeonjae.tonebridge.application.port.out.FcmNotificationPort;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
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

class SubmissionIntegrationTest extends PostgresIntegrationTest {
    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean FcmNotificationPort notifications;
    @MockitoSpyBean SubmissionPort receipts;
    MockMvc mvc;
    UUID owner, requester, operation, request, session;
    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        owner = user(); requester = user(); operation = UUID.randomUUID(); request = UUID.randomUUID(); session = UUID.randomUUID();
        jdbc.update("INSERT INTO correction_requests(id,requester_id,type,target_language,content_text,status,credit_cost) VALUES (?,?,'TEXT','en','Original','PENDING',0)", request, requester);
        jdbc.update("INSERT INTO study_sessions(id,created_by,title) VALUES (?,?,'Practice')", session, owner);
        jdbc.update("INSERT INTO session_members(session_id,user_id) VALUES (?,?),(?,?)", session, owner, session, requester);
    }
    @ParameterizedTest @ValueSource(booleans = {true, false})
    void concurrentAndLostResponsesReplayOneRecordAndOneReceipt(boolean correction) throws Exception {
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<String> save = () -> { start.await(); return id(save(correction, owner, operation, body(correction), 201)); };
            var a = executor.submit(save); var b = executor.submit(save); start.countDown();
            String first = a.get(15, TimeUnit.SECONDS);
            assertThat(b.get(15, TimeUnit.SECONDS)).isEqualTo(first);
            assertThat(id(save(correction, owner, operation, body(correction), 201))).isEqualTo(first);
            mvc.perform(get("/api/submissions/{id}", operation).with(as(owner))).andExpect(status().isOk()).andExpect(jsonPath("$.resourceId").value(first));
            mvc.perform(post("/api/submissions/{id}/cancel", operation).with(as(owner))).andExpect(status().isOk()).andExpect(jsonPath("$.resourceId").value(first));
        }
        assertThat(count(correction)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM submission_receipts WHERE owner_id=?", Integer.class, owner)).isEqualTo(1);
        if (!correction) verify(notifications, times(1)).sendNewStudyCard(eq(requester), eq(session), eq("Saved phrase"));
        save(correction, owner, operation, body(correction).replace("Saved", "Changed"), 409);
        assertThat(count(correction)).isEqualTo(1);
    }
    @ParameterizedTest @ValueSource(booleans = {true, false})
    void cancelledIdentityBlocksLateWrites(boolean correction) throws Exception {
        mvc.perform(post("/api/submissions/{id}/cancel", operation).with(as(owner))).andExpect(status().isOk()).andExpect(jsonPath("$.type").value("cancelled"));
        save(correction, owner, operation, body(correction), 409);
        assertThat(count(correction)).isZero();
        save(correction, owner, UUID.randomUUID(), body(correction), 201);
        assertThat(count(correction)).isEqualTo(1);
    }
    @ParameterizedTest @ValueSource(booleans = {true, false})
    void cancelRacingSaveHasOneWinnerAndCannotCreateTwice(boolean correction) throws Exception {
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var save = executor.submit(() -> { start.await(); return mvc.perform(post(path(correction)).with(as(owner)).header("Idempotency-Key", operation).contentType(MediaType.APPLICATION_JSON).content(body(correction))).andReturn().getResponse().getStatus(); });
            var cancel = executor.submit(() -> { start.await(); return mvc.perform(post("/api/submissions/{id}/cancel", operation).with(as(owner))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(); });
            start.countDown();
            int status = save.get(15, TimeUnit.SECONDS);
            assertThat(status).isIn(201, 409);
            String result = cancel.get(15, TimeUnit.SECONDS);
            assertThat(count(correction)).isEqualTo(status == 201 ? 1 : 0);
            assertThat(result).contains(status == 201 ? "resourceId" : "cancelled");
            save(correction, owner, operation, body(correction), status);
            assertThat(count(correction)).isEqualTo(status == 201 ? 1 : 0);
        }
    }
    @ParameterizedTest @ValueSource(booleans = {true, false})
    void failureWritingReceiptRollsBackBusinessWriteAndCanRetry(boolean correction) throws Exception {
        doThrow(new IllegalStateException("receipt failure")).doCallRealMethod().when(receipts).complete(eq(owner), eq(operation), anyString(), anyString(), any());
        save(correction, owner, operation, body(correction), 500);
        assertThat(count(correction)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM submission_receipts WHERE owner_id=?", Integer.class, owner)).isZero();
        // Only the card notification belongs to this write. A correction saved by an earlier test sends
        // sendCorrectionReady from an async quality-check thread that can land after the mock is reset,
        // so asserting "no interactions at all" made this test fail intermittently.
        if (!correction) verify(notifications, never()).sendNewStudyCard(any(), any(), any());
        save(correction, owner, operation, body(correction), 201);
        assertThat(count(correction)).isEqualTo(1);
    }
    @ParameterizedTest @ValueSource(booleans={true,false})
    void audioReceiptsReplayOneSaveRetireCloudClaimsAndRejectChangedOrRevokedRequests(boolean practice) throws Exception {
        UUID card=UUID.randomUUID(),draft=UUID.randomUUID(),epoch=UUID.randomUUID();String key="audio/"+UUID.randomUUID()+"/recording.webm";
        jdbc.update("INSERT INTO study_cards(id,session_id,created_by_user_id,phrase) VALUES (?,?,?,'Audio')",card,session,owner);
        jdbc.update("INSERT INTO audio_upload_owners(audio_key,owner_id) VALUES (?,?)",key,owner);
        jdbc.update("INSERT INTO cloud_draft_settings(owner_id,enabled,epoch,version,audio_enabled) VALUES (?,true,?,2,true)",owner,epoch);
        jdbc.update("INSERT INTO cloud_drafts(owner_id,id,kind,scope,version,state,value,expires_at,pending_operation,pending_kind,pending_payload) VALUES (?,?,'recording',?,1,'ACTIVE','{}',now()+interval '7 days',?,'SUBMISSION','{}')",owner,draft,"audio:"+(practice?"practice:":"example:")+card,operation);
        String path="/api/cards/"+card+(practice?"/attempts":"/native-audios"),body="{\"audioKey\":\""+key+"\"}";
        var start=new CountDownLatch(1);
        try(var executor=Executors.newFixedThreadPool(2)) {
            Callable<String> save=() -> {start.await();return id(mvc.perform(post(path).with(as(owner)).header("Idempotency-Key",operation).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());};
            var first=executor.submit(save);var second=executor.submit(save);start.countDown();assertThat(second.get(15,TimeUnit.SECONDS)).isEqualTo(first.get(15,TimeUnit.SECONDS));
        }
        assertThat(jdbc.queryForObject("SELECT state FROM cloud_drafts WHERE owner_id=? AND id=?",String.class,owner,draft)).isEqualTo("SUBMITTED");
        mvc.perform(get("/api/submissions/{id}",operation).with(as(owner))).andExpect(status().isOk()).andExpect(jsonPath("$.type").value(practice?"practice":"example"));
        mvc.perform(get("/api/submissions/{id}",operation).with(as(requester))).andExpect(status().isNotFound());
        mvc.perform(post(path).with(as(owner)).header("Idempotency-Key",operation).contentType(MediaType.APPLICATION_JSON).content(body.replace("recording","changed"))).andExpect(status().isConflict());
        jdbc.update("DELETE FROM session_members WHERE session_id=? AND user_id=?",session,owner);
        mvc.perform(get("/api/submissions/{id}",operation).with(as(owner))).andExpect(status().isForbidden());
        jdbc.update("INSERT INTO session_members(session_id,user_id) VALUES (?,?)",session,owner);
        jdbc.update("UPDATE study_cards SET deleted_at=now() WHERE id=?",card);
        mvc.perform(post(path).with(as(owner)).header("Idempotency-Key",operation).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isConflict());
    }
    @Test void identitiesAreAccountScopedAndCannotRevealOtherOwnersResults() throws Exception {
        save(false, owner, operation, body(false), 201);
        mvc.perform(get("/api/submissions/{id}", operation).with(as(requester))).andExpect(status().isNotFound());
        save(false, requester, operation, body(false), 201);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM study_cards WHERE session_id=?", Integer.class, session)).isEqualTo(2);
        save(true, owner, operation, body(true), 409); // same owner's identity cannot change operation kind
    }
    @Test void replaysRecheckMembershipAndDeletedRecordsCannotBeRecreated() throws Exception {
        String card = id(save(false, owner, operation, body(false), 201));
        jdbc.update("DELETE FROM session_members WHERE session_id=? AND user_id=?", session, owner);
        save(false, owner, operation, body(false), 403);
        mvc.perform(get("/api/submissions/{id}", operation).with(as(owner))).andExpect(status().isForbidden());
        mvc.perform(post("/api/submissions/{id}/cancel", operation).with(as(owner))).andExpect(status().isOk()).andExpect(jsonPath("$.type").value("unavailable"));
        jdbc.update("INSERT INTO session_members(session_id,user_id) VALUES (?,?)", session, owner);
        jdbc.update("UPDATE study_cards SET deleted_at=NOW() WHERE id=?", UUID.fromString(card));
        save(false, owner, operation, body(false), 409);
        assertThat(count(false)).isEqualTo(1);
    }
    @Test void deletedCorrectionOrParentDoesNotBecomeAReplayGrant() throws Exception {
        String correction = id(save(true, owner, operation, body(true), 201));
        jdbc.update("UPDATE correction_requests SET deleted_at=NOW() WHERE id=?", request);
        save(true, owner, operation, body(true), 409);
        mvc.perform(get("/api/submissions/{id}", operation).with(as(owner))).andExpect(status().isConflict());
        jdbc.update("UPDATE correction_requests SET deleted_at=NULL WHERE id=?", request);
        jdbc.update("UPDATE corrections SET deleted_at=NOW() WHERE id=?", UUID.fromString(correction));
        save(true, owner, operation, body(true), 409);
        assertThat(count(true)).isEqualTo(1);
    }
    @Test void authenticationAndHeaderValidationRemainRequired() throws Exception {
        mvc.perform(get("/api/submissions/{id}", operation)).andExpect(status().isUnauthorized());
        mvc.perform(post(path(true)).with(as(owner)).header("Idempotency-Key", "invalid").contentType(MediaType.APPLICATION_JSON).content(body(true))).andExpect(status().isBadRequest());
        save(true, requester, operation, body(true), 400); // cannot correct own request
        assertThat(count(true)).isZero();
    }
    private String path(boolean correction) { return correction ? "/api/corrections" : "/api/sessions/" + session + "/cards"; }
    private String body(boolean correction) { return correction ? "{\"requestId\":\"" + request + "\",\"correctedText\":\"Saved phrase\",\"explanation\":\"Saved sufficiently detailed explanation\"}" : "{\"phrase\":\"Saved phrase\",\"context\":\"Context\",\"tags\":[]}"; }
    private String save(boolean correction, UUID actor, UUID operation, String body, int expected) throws Exception {
        return mvc.perform(post(path(correction)).with(as(actor)).header("Idempotency-Key", operation).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();
    }
    private String id(String json) { return tools.jackson.databind.json.JsonMapper.builder().build().readTree(json).get("id").asText(); }
    private int count(boolean correction) { return jdbc.queryForObject(correction ? "SELECT count(*) FROM corrections WHERE request_id=?" : "SELECT count(*) FROM study_cards WHERE session_id=?", Integer.class, correction ? request : session); }
    private UUID user() { UUID id = UUID.randomUUID(); jdbc.update("INSERT INTO users(id,email,username,native_language) VALUES (?,?,?,'ko')", id, id + "@test.invalid", "u" + id.toString().substring(0,8)); return id; }
    private static RequestPostProcessor as(UUID user) { return authentication(new UsernamePasswordAuthenticationToken(user, null, List.of(new SimpleGrantedAuthority("ROLE_USER")))); }
}
