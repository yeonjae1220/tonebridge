package me.yeonjae.tonebridge.adapter.in.web;

import me.yeonjae.tonebridge.support.PostgresIntegrationTest;
import me.yeonjae.tonebridge.application.port.out.FcmNotificationPort;
import me.yeonjae.tonebridge.application.port.out.NotificationPort;
import me.yeonjae.tonebridge.application.service.*;
import me.yeonjae.tonebridge.shared.event.CorrectionNoteAddedEvent;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class UserBlockIntegrationTest extends PostgresIntegrationTest {
    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired CorrectionNotificationListener notes;
    @Autowired QualityCheckEventHandler quality;
    @Autowired me.yeonjae.tonebridge.application.port.out.CorrectionPort correctionRecords;
    @MockitoBean FcmNotificationPort notifications;
    @MockitoBean NotificationPort sse;
    @MockitoBean StreakService streaks;
    @MockitoBean BadgeService badges;
    @MockitoBean me.yeonjae.tonebridge.shared.config.StorageRateLimitInterceptor storageLimits;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
    @Autowired UserBlockService blocks;
    MockMvc mvc;
    UUID a,b,c,session,card,request,correction;
    @BeforeEach void setup() throws Exception {
        when(storageLimits.preHandle(any(),any(),any())).thenReturn(true);
        mvc=MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        a=user(); b=user(); c=user(); session=UUID.randomUUID(); card=UUID.randomUUID(); request=UUID.randomUUID(); correction=UUID.randomUUID();
        jdbc.update("INSERT INTO study_sessions(id,created_by,title) VALUES (?,?,'Shared')",session,a);
        jdbc.update("INSERT INTO session_members(session_id,user_id) VALUES (?,?),(?,?)",session,a,session,b);
        jdbc.update("INSERT INTO study_cards(id,session_id,created_by_user_id,phrase,tags) VALUES (?,?,?,'test','')",card,session,a);
        jdbc.update("INSERT INTO friend_requests(sender_id,receiver_id,status) VALUES (?,?,'ACCEPTED')",a,b);
        jdbc.update("INSERT INTO correction_requests(id,requester_id,type,target_language,content_text,status,credit_cost,audio_url) VALUES (?,?,'TEXT','en','Original','PENDING',0,?)",request,b,"audio/"+b+"/test.webm");
        jdbc.update("INSERT INTO corrections(id,request_id,corrector_id,corrected_text,explanation) VALUES (?,?,?,'fixed','Explanation')",correction,request,a);
    }
    @Test void authenticationOwnershipIdempotencyAndPagination() throws Exception {
        mvc.perform(get("/api/users/me/blocks")).andExpect(status().isUnauthorized());
        mvc.perform(put(path(b))).andExpect(status().isUnauthorized());
        mvc.perform(put(path(a)).with(as(a))).andExpect(status().isBadRequest());
        block(a,b); block(a,b);
        mvc.perform(get("/api/users/me/blocks").with(as(a))).andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.items[0].userId").value(b.toString())).andExpect(jsonPath("$.items[0].email").doesNotExist());
        mvc.perform(get("/api/users/me/blocks").with(as(c))).andExpect(jsonPath("$.items.length()").value(0));
        mvc.perform(get("/api/users/me/blocks?page=-1").with(as(a))).andExpect(status().isBadRequest());
        mvc.perform(delete(path(b)).with(as(c))).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM user_blocks WHERE blocker_id=?",Integer.class,a)).isEqualTo(1);
    }
    @Test void closesSharingPreservesRecordsAndUnblockDoesNotRestoreIt() throws Exception {
        block(a,b);
        for(UUID actor:List.of(a,b)) {
            mvc.perform(get("/api/friends").with(as(actor))).andExpect(jsonPath("$.length()").value(0));
            mvc.perform(get("/api/sessions/{id}/cards",session).with(as(actor))).andExpect(status().isForbidden());
            mvc.perform(get("/api/cards/{id}",card).with(as(actor))).andExpect(status().isForbidden());
            mvc.perform(post("/api/friends/request").with(as(actor)).contentType(MediaType.APPLICATION_JSON).content("{\"receiverUsername\":\""+name(actor.equals(a)?b:a)+"\"}")).andExpect(status().isForbidden());
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM study_cards WHERE id=?",Integer.class,card)).isEqualTo(1);
        mvc.perform(delete(path(b)).with(as(a))).andExpect(status().isNoContent());
        mvc.perform(delete(path(b)).with(as(a))).andExpect(status().isNoContent());
        mvc.perform(get("/api/sessions/{id}/cards",session).with(as(a))).andExpect(status().isForbidden());
        mvc.perform(get("/api/friends").with(as(a))).andExpect(jsonPath("$.length()").value(0));
    }
    @Test void blocksFeedDirectRequestsAudioCorrectionActionsAndSearch() throws Exception {
        block(a,b);
        mvc.perform(get("/api/correction-requests/feed/page?limit=1").with(as(a))).andExpect(status().isOk()).andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString(request.toString()))));
        mvc.perform(get("/api/correction-requests/{id}",request).with(as(a))).andExpect(status().isNotFound());
        mvc.perform(get("/api/corrections/request/{id}",request).with(as(a))).andExpect(status().isForbidden());
        mvc.perform(get("/api/corrections/request/{id}",request).with(as(b))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/storage/presigned-download").param("key","audio/"+b+"/test.webm").with(as(a))).andExpect(status().isForbidden());
        mvc.perform(get("/api/users/search").param("q",name(b)).with(as(a))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(put("/api/corrections/{id}/like",correction).with(as(b))).andExpect(status().isForbidden());
        mvc.perform(post("/api/corrections/{id}/accept",correction).with(as(b))).andExpect(status().isForbidden());
        mvc.perform(post("/api/corrections/{id}/rate",correction).with(as(b)).contentType(MediaType.APPLICATION_JSON).content("{\"helpful\":true}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/corrections").with(as(a)).contentType(MediaType.APPLICATION_JSON).content("{\"requestId\":\""+request+"\",\"correctedText\":\"Fix\",\"explanation\":\"Detailed explanation\"}")).andExpect(status().isForbidden());
        // An unrelated learner still sees the request, and the owner retains their own record.
        mvc.perform(get("/api/correction-requests/{id}",request).with(as(c))).andExpect(status().isOk());
        mvc.perform(get("/api/correction-requests/{id}",request).with(as(b))).andExpect(status().isOk());
    }
    @Test void reverseBlockRemainsWhenOnlyOneSideUnblocks() throws Exception {
        block(a,b); block(b,a);
        mvc.perform(delete(path(b)).with(as(a))).andExpect(status().isNoContent());
        mvc.perform(get("/api/correction-requests/{id}",request).with(as(a))).andExpect(status().isNotFound());
    }
    @Test void delayedNotificationsAreSuppressed() throws Exception {
        block(a,b);
        quality.handle(new QualityCheckCompletedEvent(correction,a,b,true,0,false));
        notes.onCorrectionNoteAdded(new CorrectionNoteAddedEvent(b,card,session,name(a),a));
        // Wait for the async listener without relying on a fixed sleep.
        verify(notifications, after(500).never()).sendCorrectionNoteAdded(any(),any(),any(),any());
        verify(notifications, never()).sendCorrectionReady(any(),any());
        verifyNoInteractions(sse);
    }
    @Test void concurrentSharedCreationAndBlockCannotLeaveSharing() throws Exception {
        var start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var create=pool.submit(() -> { start.await(); return mvc.perform(post("/api/sessions").with(as(a)).contentType(MediaType.APPLICATION_JSON).content("{\"friendId\":\""+b+"\",\"title\":\"New\"}")).andReturn().getResponse().getStatus(); });
            var block=pool.submit(() -> { start.await(); block(a,b); return true; });
            start.countDown(); assertThat(create.get(15,TimeUnit.SECONDS)).isIn(201,403); assertThat(block.get(15,TimeUnit.SECONDS)).isTrue();
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM session_members x JOIN session_members y ON x.session_id=y.session_id WHERE x.user_id=? AND y.user_id=?",Integer.class,a,b)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM friend_requests WHERE sender_id=? AND receiver_id=?",Integer.class,a,b)).isZero();
    }
    @Test void concurrentAcceptanceCannotRecreateRemovedRequest() throws Exception {
        jdbc.update("UPDATE friend_requests SET status='PENDING' WHERE sender_id=? AND receiver_id=?",a,b);
        var id=jdbc.queryForObject("SELECT id FROM friend_requests WHERE sender_id=? AND receiver_id=?",UUID.class,a,b);
        var start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var accept=pool.submit(() -> { start.await(); return mvc.perform(post("/api/friends/{id}/accept",id).with(as(b))).andReturn().getResponse().getStatus(); });
            var blocking=pool.submit(() -> { start.await(); block(a,b); return true; });
            start.countDown(); assertThat(accept.get(15,TimeUnit.SECONDS)).isIn(200,403,404); assertThat(blocking.get(15,TimeUnit.SECONDS)).isTrue();
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM friend_requests WHERE sender_id=? AND receiver_id=?",Integer.class,a,b)).isZero();
    }
    @Test void filteredFeedFindsVisibleItemsBeyondBlockedFirstPage() throws Exception {
        UUID visible=UUID.randomUUID();
        jdbc.update("INSERT INTO correction_requests(id,requester_id,type,target_language,content_text,status,credit_cost,created_at) VALUES (?,?,'TEXT','en','Visible','PENDING',0,now()-interval '1 day')",visible,c);
        for(int i=0;i<4;i++) jdbc.update("INSERT INTO correction_requests(requester_id,type,target_language,content_text,status,credit_cost) VALUES (?,'TEXT','en','Hidden','PENDING',0)",b);
        block(a,b);
        // Isolate this user's language so unrelated integration fixtures cannot fill the page.
        jdbc.update("UPDATE users SET native_language='zz' WHERE id=?",a);
        jdbc.update("UPDATE correction_requests SET target_language='zz' WHERE requester_id IN (?,?)",b,c);
        mvc.perform(get("/api/correction-requests/feed/page?limit=1").with(as(a))).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(visible.toString())).andExpect(jsonPath("$.nextCursor").isEmpty());
    }
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(booleans={true,false})
    void receiptWritesAndBlockingUseTheSameLockOrder(boolean composition) throws Exception {
        var start=new CountDownLatch(1);
        String body=composition ? "{\"kind\":\"TEXT\",\"destination\":\"FRIEND\",\"friendId\":\""+b+"\",\"contentText\":\"Saved\",\"goals\":[]}" : "{\"requestId\":\""+request+"\",\"correctedText\":\"Saved\",\"explanation\":\"Explanation\"}";
        // A new request avoids the existing correction uniqueness constraint.
        if (!composition) jdbc.update("DELETE FROM corrections WHERE id=?",correction);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var save=pool.submit(() -> { start.await(); return mvc.perform(post(composition ? "/api/compositions/"+UUID.randomUUID() : "/api/corrections").header("Idempotency-Key",UUID.randomUUID()).with(as(a)).contentType(MediaType.APPLICATION_JSON).content(body)).andReturn().getResponse().getStatus(); });
            var blocking=pool.submit(() -> { start.await(); block(a,b); return true; });
            start.countDown(); assertThat(save.get(15,TimeUnit.SECONDS)).isIn(composition?200:201,403); assertThat(blocking.get(15,TimeUnit.SECONDS)).isTrue();
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM session_members x JOIN session_members y ON x.session_id=y.session_id WHERE x.user_id=? AND y.user_id=?",Integer.class,a,b)).isZero();
    }
    @Test void notificationFollowupAudioCountUsesTheDomainEnumAndExcludesDeletedParents() {
        assertThat(correctionRecords.countApprovedAudioByCorrector(a)).isZero();
        jdbc.update("UPDATE corrections SET status='APPROVED' WHERE id=?",correction);
        assertThat(correctionRecords.countApprovedAudioByCorrector(a)).isZero(); // text
        jdbc.update("UPDATE correction_requests SET type='AUDIO',content_text=NULL WHERE id=?",request);
        assertThat(correctionRecords.countApprovedAudioByCorrector(a)).isEqualTo(1);
        assertThat(correctionRecords.countApprovedAudioByCorrector(c)).isZero();
        jdbc.update("UPDATE correction_requests SET deleted_at=now() WHERE id=?",request);
        assertThat(correctionRecords.countApprovedAudioByCorrector(a)).isZero();
    }
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings={"update","rate","accept","like","unlike","toggle","third-party-like"})
    void correctionWritesCannotPassAnInFlightBlock(String action) throws Exception {
        var started=new CountDownLatch(1);var release=new CountDownLatch(1);
        UUID actor=action.equals("update")?a:action.equals("third-party-like")?c:b;
        UUID blocker=action.equals("third-party-like")?c:b;
        try(var pool=Executors.newFixedThreadPool(2)) {
            var blocking=pool.submit(() -> new org.springframework.transaction.support.TransactionTemplate(transactions).execute(status -> {
                jdbc.queryForList("SELECT id FROM users WHERE id IN (?,?) ORDER BY id FOR UPDATE",UUID.class,a,blocker);
                started.countDown();
                try { if(!release.await(10,TimeUnit.SECONDS)) throw new IllegalStateException("test gate timed out"); }
                catch(InterruptedException e){Thread.currentThread().interrupt();throw new IllegalStateException(e);}
                blocks.block(blocker,a);return true;
            }));
            assertThat(started.await(10,TimeUnit.SECONDS)).isTrue();
            var write=pool.submit(() -> {
                var url="/api/corrections/"+correction;
                var req=switch(action) {
                    case "update" -> patch(url).contentType(MediaType.APPLICATION_JSON).content("{\"correctedText\":\"late change\",\"explanation\":\"late explanation\"}");
                    case "rate" -> post(url+"/rate").contentType(MediaType.APPLICATION_JSON).content("{\"helpful\":true}");
                    case "accept" -> post(url+"/accept");
                    case "unlike" -> delete(url+"/like");
                    case "toggle" -> post(url+"/like");
                    default -> put(url+"/like");
                };
                return mvc.perform(req.with(as(actor))).andReturn().getResponse().getStatus();
            });
            try {
                // Wait for the actual database lock, or the vulnerable write finishing early.
                org.awaitility.Awaitility.await().atMost(5,TimeUnit.SECONDS).until(() -> write.isDone() ||
                    jdbc.queryForObject("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'",Integer.class)>0);
            } finally { release.countDown(); }
            assertThat(blocking.get(10,TimeUnit.SECONDS)).isTrue();
            assertThat(write.get(10,TimeUnit.SECONDS)).isEqualTo(403);
        }
        assertThat(jdbc.queryForObject("SELECT corrected_text FROM corrections WHERE id=?",String.class,correction)).isEqualTo("fixed");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM ratings WHERE correction_id=?",Integer.class,correction)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM correction_likes WHERE correction_id=?",Integer.class,correction)).isZero();
        assertThat(jdbc.queryForObject("SELECT accepted_correction_id FROM correction_requests WHERE id=?",UUID.class,request)).isNull();
    }
    private String path(UUID target) { return "/api/users/me/blocks/"+target; }
    private void block(UUID actor,UUID target) throws Exception { mvc.perform(put(path(target)).with(as(actor))).andExpect(status().isNoContent()); }
    private String name(UUID id) { return "u"+id.toString().substring(0,8); }
    private UUID user() { UUID id=UUID.randomUUID(); jdbc.update("INSERT INTO users(id,email,username,native_language) VALUES (?,?,?,'en')",id,id+"@test.invalid",name(id)); return id; }
    private static RequestPostProcessor as(UUID user) { return authentication(new UsernamePasswordAuthenticationToken(user,null,List.of(new SimpleGrantedAuthority("ROLE_USER")))); }
}
