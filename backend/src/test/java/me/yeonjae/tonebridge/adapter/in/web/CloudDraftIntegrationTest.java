package me.yeonjae.tonebridge.adapter.in.web;

import me.yeonjae.tonebridge.support.PostgresIntegrationTest;
import me.yeonjae.tonebridge.application.service.CloudDraftService;
import me.yeonjae.tonebridge.application.service.CloudDraftService.*;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class CloudDraftIntegrationTest extends PostgresIntegrationTest {
    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired CloudDraftService drafts;
    @MockitoBean me.yeonjae.tonebridge.application.port.out.FcmNotificationPort notifications;
    static final ObjectMapper JSON=new ObjectMapper();
    MockMvc mvc;
    UUID owner,other,id,epoch;
    @BeforeEach void setup() {
        mvc=MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        owner=user();other=user();id=UUID.randomUUID();epoch=null;
    }
    @Test void defaultsOffAndAllDataRoutesAreOwnerScoped() throws Exception {
        mvc.perform(get("/api/users/me/drafts/settings").with(as(owner))).andExpect(status().isOk()).andExpect(jsonPath("$.enabled").value(false)).andExpect(header().string("Cache-Control","no-store"));
        mvc.perform(get("/api/users/me/drafts")).andExpect(status().isUnauthorized());
        var disabled=new Write(UUID.randomUUID(),UUID.randomUUID(),0,"editor","compose",value("first"));
        write(owner,id,disabled,409);enable();write(owner,id,input(0,"first"),200);
        mvc.perform(get(path(id)).with(as(other))).andExpect(status().isNotFound());
        mvc.perform(get(path(id)+"/history").with(as(other))).andExpect(status().isNotFound());
        mvc.perform(get("/api/users/me/drafts").with(as(other))).andExpect(jsonPath("$.length()").value(0));
    }
    @Test void concurrentLostResponseRetriesHaveOneRevisionAndChangedPayloadIsRejected() throws Exception {
        enable();var input=input(0,"first");var start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            Callable<String> call=() -> {start.await();return write(owner,id,input,200);};
            var a=pool.submit(call);var b=pool.submit(call);start.countDown();assertThat(a.get(15,TimeUnit.SECONDS)).isEqualTo(b.get(15,TimeUnit.SECONDS));
        }
        assertThat(drafts.history(owner,id)).hasSize(1);
        write(owner,id,new Write(input.operationId(),epoch,0,"editor","compose",value("changed")),409);
        write(owner,id,input(1,"newer"),200);
        write(owner,id,input,200);assertThat(drafts.get(owner,id).value().get("contentText")).isEqualTo("newer");
    }
    @Test void sameValueDoesNotAddHistoryOrExtendExpiry() throws Exception {
        enable();write(owner,id,input(0,"same"),200);var before=drafts.get(owner,id);
        write(owner,id,input(1,"same"),200);var after=drafts.get(owner,id);
        assertThat(after.version()).isEqualTo(1);assertThat(after.expiresAt()).isEqualTo(before.expiresAt());assertThat(drafts.history(owner,id)).hasSize(1);
    }
    @Test void competingDevicesCannotOverwriteEachOthersRevision() throws Exception {
        enable();write(owner,id,input(0,"base"),200);var start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var a=pool.submit(() -> {start.await();return rawWrite(input(1,"device A"));});
            var b=pool.submit(() -> {start.await();return rawWrite(input(1,"device B"));});
            start.countDown();assertThat(List.of(a.get(15,TimeUnit.SECONDS),b.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);
        }
        assertThat(drafts.history(owner,id)).hasSize(2);
    }
    @Test void historyIsBoundedAndRestoreCreatesANewVersion() throws Exception {
        enable();for(int v=1;v<=22;v++)write(owner,id,input(v-1,"version "+v),200);
        assertThat(drafts.history(owner,id)).hasSize(20);assertThat(drafts.history(owner,id).getLast().version()).isEqualTo(3);
        var change=new Change(UUID.randomUUID(),epoch,22);
        mvc.perform(post(path(id)+"/history/3/restore").with(as(owner)).contentType(MediaType.APPLICATION_JSON).content(JSON.writeValueAsString(change))).andExpect(status().isOk()).andExpect(jsonPath("$.version").value(23));
        assertThat(drafts.get(owner,id).value().get("contentText")).isEqualTo("version 3");assertThat(drafts.history(owner,id)).hasSize(20);
        drafts.restore(owner,id,23,new Change(UUID.randomUUID(),epoch,23));assertThat(drafts.get(owner,id).version()).isEqualTo(24);
    }
    @Test void expiredRevisionsAreCleanedEvenWhileCurrentDraftRemainsActive() throws Exception {
        enable();write(owner,id,input(0,"old"),200);write(owner,id,input(1,"current"),200);
        jdbc.update("UPDATE cloud_draft_revisions SET expires_at=now()-interval '1 second' WHERE owner_id=? AND version=1",owner);
        assertThat(drafts.expiredOwners()).contains(owner);drafts.cleanOwner(owner);
        assertThat(drafts.history(owner,id)).hasSize(1);assertThat(drafts.get(owner,id).state()).isEqualTo("ACTIVE");
        assertThatThrownBy(() -> drafts.restore(owner,id,1,new Change(UUID.randomUUID(),epoch,2))).isInstanceOf(ToneBridgeException.class);
    }
    @Test void deletionAndExpiryLeaveNoContentAndRejectOfflineResurrection() throws Exception {
        enable();var original=input(0,"private draft");write(owner,id,original,200);
        drafts.delete(owner,id,new Change(UUID.randomUUID(),epoch,1));
        write(owner,id,input(1,"stale device"),409);write(owner,id,input(0,"stale create"),409);write(owner,id,original,200);
        assertThat(drafts.get(owner,id).state()).isEqualTo("DELETED");assertThat(drafts.get(owner,id).value()).isNull();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM cloud_draft_revisions WHERE owner_id=?",Integer.class,owner)).isZero();
        id=UUID.randomUUID();write(owner,id,input(0,"expires"),200);
        jdbc.update("UPDATE cloud_drafts SET expires_at=now()-interval '1 second' WHERE owner_id=? AND id=?",owner,id);drafts.cleanOwner(owner);
        assertThat(drafts.get(owner,id).state()).isEqualTo("EXPIRED");write(owner,id,input(1,"late"),409);
    }
    @Test void disablingPreservesCloudDataButEraseRotatesEpochAndDoesNotRepeat() throws Exception {
        enable();write(owner,id,input(0,"keep"),200);
        drafts.preferences(owner,new Preferences(UUID.randomUUID(),1,false,false));
        assertThat(drafts.get(owner,id).value().get("contentText")).isEqualTo("keep");write(owner,id,input(1,"must not sync"),409);
        var erase=new Preferences(UUID.randomUUID(),2,false,true);var cleared=drafts.preferences(owner,erase);
        assertThat(cleared.epoch()).isNotEqualTo(epoch);assertThat(drafts.list(owner)).isEmpty();
        drafts.preferences(owner,new Preferences(UUID.randomUUID(),3,true,false));
        UUID old=epoch;epoch=cleared.epoch();id=UUID.randomUUID();write(owner,id,input(0,"new consent"),200);
        drafts.preferences(owner,erase);assertThat(drafts.list(owner)).hasSize(1);
        write(owner,UUID.randomUUID(),new Write(UUID.randomUUID(),old,0,"editor","compose",value("offline old epoch")),409);
    }
    @Test void pendingClaimBlocksOtherDevicesAndCompletionRetiresInTheReceiptTransaction() throws Exception {
        enable();write(owner,id,input(0,"Hello"),200);UUID operation=UUID.randomUUID();
        var prepared=drafts.prepare(owner,id,new Prepare(epoch,1,operation,"COMPOSITION",composition()));
        assertThat(prepared.pendingOperation()).isEqualTo(operation);
        assertThat(drafts.prepare(owner,id,new Prepare(epoch,1,operation,"COMPOSITION",composition())).version()).isEqualTo(prepared.version());
        assertThatThrownBy(() -> drafts.prepare(owner,id,new Prepare(epoch,prepared.version(),UUID.randomUUID(),"COMPOSITION",composition()))).isInstanceOf(ToneBridgeException.class);
        write(owner,id,input(prepared.version(),"other device"),409);
        mvc.perform(post("/api/compositions/"+operation).with(as(owner)).contentType(MediaType.APPLICATION_JSON).content(JSON.writeValueAsString(composition()))).andExpect(status().isOk());
        assertThat(drafts.get(owner,id).state()).isEqualTo("SUBMITTED");assertThat(drafts.get(owner,id).value()).isNull();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM cloud_draft_revisions WHERE owner_id=?",Integer.class,owner)).isZero();
        mvc.perform(post("/api/compositions/"+operation).with(as(owner)).contentType(MediaType.APPLICATION_JSON).content(JSON.writeValueAsString(composition()))).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM study_cards WHERE created_by_user_id=?",Integer.class,owner)).isEqualTo(1);
    }
    @Test void cancelledSubmissionAllowsEditingAndOldOperationCanNeverPost() throws Exception {
        enable();write(owner,id,input(0,"Hello"),200);UUID operation=UUID.randomUUID();drafts.prepare(owner,id,new Prepare(epoch,1,operation,"COMPOSITION",composition()));
        mvc.perform(post("/api/compositions/"+operation+"/cancel").with(as(owner))).andExpect(status().isNoContent());
        var draft=drafts.get(owner,id);assertThat(draft.pendingOperation()).isNull();write(owner,id,input(draft.version(),"new edit"),200);
        mvc.perform(post("/api/compositions/"+operation).with(as(owner)).contentType(MediaType.APPLICATION_JSON).content(JSON.writeValueAsString(composition()))).andExpect(status().isConflict());
    }
    @Test void erasingAndExpiringPendingDraftsCancelLatePosts() throws Exception {
        enable();write(owner,id,input(0,"Hello"),200);UUID operation=UUID.randomUUID();drafts.prepare(owner,id,new Prepare(epoch,1,operation,"COMPOSITION",composition()));
        drafts.preferences(owner,new Preferences(UUID.randomUUID(),1,false,true));
        mvc.perform(post("/api/compositions/"+operation).with(as(owner)).contentType(MediaType.APPLICATION_JSON).content(JSON.writeValueAsString(composition()))).andExpect(status().isConflict());
        var settings=drafts.preferences(owner,new Preferences(UUID.randomUUID(),2,true,false));epoch=settings.epoch();id=UUID.randomUUID();write(owner,id,input(0,"expires"),200);
        UUID late=UUID.randomUUID();drafts.prepare(owner,id,new Prepare(epoch,1,late,"COMPOSITION",composition()));
        jdbc.update("UPDATE cloud_drafts SET expires_at=now()-interval '1 second' WHERE owner_id=?",owner);drafts.cleanOwner(owner);
        mvc.perform(post("/api/compositions/"+late).with(as(owner)).contentType(MediaType.APPLICATION_JSON).content(JSON.writeValueAsString(composition()))).andExpect(status().isConflict());
    }
    @Test void disabledSyncDoesNotStoreNewPendingText() throws Exception {
        enable();write(owner,id,input(0,"saved cloud text"),200);drafts.preferences(owner,new Preferences(UUID.randomUUID(),1,false,false));
        var claim=drafts.prepare(owner,id,new Prepare(epoch,1,UUID.randomUUID(),"COMPOSITION",composition()));
        assertThat(claim.pendingPayload()).isNull();assertThat(claim.value().get("contentText")).isEqualTo("saved cloud text");
    }
    @Test void activeDraftAndAccountTextLimitsRejectWithoutPartialRows() throws Exception {
        enable();for(int n=0;n<50;n++)write(owner,UUID.randomUUID(),input(0,"draft"),200);
        write(owner,id,input(0,"too many"),413);assertThat(drafts.list(owner)).hasSize(50);
        owner=user();enable();write(owner,id,input(0,"base"),200);
        jdbc.update("UPDATE cloud_draft_revisions SET value=jsonb_build_object('contentText',repeat('x',26*1024*1024)) WHERE owner_id=?",owner);
        write(owner,UUID.randomUUID(),input(0,"over text quota"),413);assertThat(drafts.list(owner)).hasSize(1);
    }
    @Test void invalidSchemasAndOversizedContentAreRejectedAndDeletionCascades() throws Exception {
        enable();var invalid=value("text");invalid.put("password","not a draft field");write(owner,id,new Write(UUID.randomUUID(),epoch,0,"editor","compose",invalid),400);
        write(owner,id,input(0,"x".repeat(10001)),400);write(owner,id,input(0,"valid"),200);
        jdbc.update("DELETE FROM users WHERE id=?",owner);
        for(String table:List.of("cloud_draft_settings","cloud_drafts","cloud_draft_revisions","cloud_draft_operations"))assertThat(jdbc.queryForObject("SELECT count(*) FROM "+table+" WHERE owner_id=?",Integer.class,owner)).isZero();
    }
    @Test void statusRecoveryIsOwnerScopedAndRateLimitStillAllowsStoppingSync() throws Exception {
        enable();var request=input(0,"recoverable");write(owner,id,request,200);
        mvc.perform(get("/api/users/me/drafts/operations/"+request.operationId()).with(as(owner))).andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1));
        mvc.perform(get("/api/users/me/drafts/operations/"+request.operationId()).with(as(other))).andExpect(status().isNotFound());
        jdbc.update("INSERT INTO cloud_draft_operations(owner_id,operation_id,fingerprint,applied_version) SELECT ?,gen_random_uuid(),repeat('a',64),1 FROM generate_series(1,120)",owner);
        write(owner,UUID.randomUUID(),input(0,"rate limited"),429);
        assertThat(drafts.preferences(owner,new Preferences(UUID.randomUUID(),1,false,false)).enabled()).isFalse();
    }
    @Test void cardReceiptCompletionAndCancellationUpdateTheirLinkedDrafts() throws Exception {
        enable();UUID session=UUID.randomUUID(),operation=UUID.randomUUID();
        jdbc.update("INSERT INTO study_sessions(id,title,created_by) VALUES (?,'Practice',?)",session,owner);
        jdbc.update("INSERT INTO session_members(session_id,user_id) VALUES (?,?)",session,owner);
        Map<String,Object> value=Map.of("kind","card","sessionId",session.toString(),"phrase","Card text","context","","tags",List.of());
        drafts.write(owner,id,new Write(UUID.randomUUID(),epoch,0,"card","card-new:"+session,value));
        Map<String,Object> payload=Map.of("sessionId",session.toString(),"phrase","Card text","context","","tags",List.of());
        drafts.prepare(owner,id,new Prepare(epoch,1,operation,"SUBMISSION",payload));
        mvc.perform(post("/api/sessions/"+session+"/cards").with(as(owner)).header("Idempotency-Key",operation).contentType(MediaType.APPLICATION_JSON).content(JSON.writeValueAsString(payload))).andExpect(status().isCreated());
        assertThat(drafts.get(owner,id).state()).isEqualTo("SUBMITTED");
        id=UUID.randomUUID();operation=UUID.randomUUID();drafts.write(owner,id,new Write(UUID.randomUUID(),epoch,0,"card","card-new:"+session,value));
        drafts.prepare(owner,id,new Prepare(epoch,1,operation,"SUBMISSION",payload));
        mvc.perform(post("/api/submissions/"+operation+"/cancel").with(as(owner))).andExpect(status().isOk());
        assertThat(drafts.get(owner,id).pendingOperation()).isNull();
        mvc.perform(post("/api/sessions/"+session+"/cards").with(as(owner)).header("Idempotency-Key",operation).contentType(MediaType.APPLICATION_JSON).content(JSON.writeValueAsString(payload))).andExpect(status().isConflict());
    }
    @Test void exportIncludesStructuredCloudHistoryAndDeletionRevokesExistingArchives() throws Exception {
        enable();write(owner,id,input(0,"Exportable draft"),200);
        var export=context.getBean(me.yeonjae.tonebridge.application.service.PersonalExportData.class);
        var snapshot=export.snapshot(owner,false);
        assertThat(JSON.writeValueAsString(snapshot.data())).contains("cloudDrafts","cloudDraftHistory","Exportable draft");
        assertThat(snapshot.checks().get("cloudDrafts")).containsExactly(id.toString());
        UUID archive=UUID.randomUUID();
        jdbc.update("INSERT INTO personal_exports(id,owner_id,include_audio,state,expires_at,byte_size,access_checks) VALUES (?,?,false,'READY',now()+interval '1 day',10,?::jsonb)",archive,owner,JSON.writeValueAsString(snapshot.checks()));
        drafts.delete(owner,id,new Change(UUID.randomUUID(),epoch,1));
        assertThat(jdbc.queryForObject("SELECT state FROM personal_exports WHERE id=?",String.class,archive)).isEqualTo("EXPIRED");
        assertThatThrownBy(() -> export.verify(owner,snapshot.checks())).isInstanceOf(ToneBridgeException.class);
    }
    @Test void offlineUploadUsesActualEditTimeAndCannotExtendExpiredContent() throws Exception {
        enable();long old=System.currentTimeMillis()-6L*86400000;
        write(owner,id,new Write(UUID.randomUUID(),epoch,0,"editor","compose",value("offline text"),old),200);
        var draft=drafts.get(owner,id);assertThat(draft.updatedAt().toEpochMilli()).isEqualTo(old);
        assertThat(draft.expiresAt()).isBefore(java.time.Instant.now().plusSeconds(2*86400));
        write(owner,UUID.randomUUID(),new Write(UUID.randomUUID(),epoch,0,"editor","compose",value("expired offline text"),old-2L*86400000),409);
        write(owner,UUID.randomUUID(),new Write(UUID.randomUUID(),epoch,0,"editor","compose",value("future clock"),System.currentTimeMillis()+86400000),400);
        drafts.restore(owner,id,1,new Change(UUID.randomUUID(),epoch,1));
        assertThat(drafts.get(owner,id).expiresAt()).isAfter(java.time.Instant.now().plusSeconds(6*86400));
    }
    private void enable(){epoch=drafts.preferences(owner,new Preferences(UUID.randomUUID(),0,true,false)).epoch();}
    private Write input(long version,String text){return new Write(UUID.randomUUID(),epoch,version,"editor","compose",value(text));}
    private static Map<String,Object> value(String text){var value=new LinkedHashMap<String,Object>();value.put("kind","TEXT");value.put("destination","PERSONAL");value.put("selectedFriendId","");value.put("targetLanguage","en");value.put("targetVariant",null);value.put("contentText",text);value.put("context","");value.put("selectedGoals",List.of());value.put("step",0);value.put("sourceCardId",null);return value;}
    private static Map<String,Object> composition(){return Map.of("kind","TEXT","destination","PERSONAL","contentText","Hello","context","","title","Practice","targetLanguage","en","goals",List.of());}
    private String write(UUID who,UUID draft,Write input,int expected) throws Exception {return mvc.perform(put(path(draft)).with(as(who)).contentType(MediaType.APPLICATION_JSON).content(JSON.writeValueAsString(input))).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();}
    private int rawWrite(Write input) throws Exception {return mvc.perform(put(path(id)).with(as(owner)).contentType(MediaType.APPLICATION_JSON).content(JSON.writeValueAsString(input))).andReturn().getResponse().getStatus();}
    private static String path(UUID id){return "/api/users/me/drafts/"+id;}
    private UUID user(){UUID id=UUID.randomUUID();jdbc.update("INSERT INTO users(id,email,username,native_language) VALUES (?,?,?,'en')",id,id+"@test.invalid","u"+id.toString().substring(0,8));return id;}
    private static RequestPostProcessor as(UUID id){return authentication(new UsernamePasswordAuthenticationToken(id,null,List.of(new SimpleGrantedAuthority("ROLE_USER"))));}
}
