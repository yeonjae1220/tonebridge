package me.yeonjae.tonebridge.adapter.in.web;

import me.yeonjae.tonebridge.support.PostgresIntegrationTest;
import me.yeonjae.tonebridge.application.service.*;
import me.yeonjae.tonebridge.application.service.CloudDraftService.*;
import me.yeonjae.tonebridge.shared.exception.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import software.amazon.awssdk.services.s3.S3Client;
import java.io.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class CloudAudioIntegrationTest extends PostgresIntegrationTest {
    @DynamicPropertySource static void storage(DynamicPropertyRegistry properties){PersonalExportIntegrationTest.storage(properties);}
    @MockitoBean me.yeonjae.tonebridge.shared.config.StorageRateLimitInterceptor limits;
    @Autowired WebApplicationContext context;
    @Autowired CloudAudioFiles files;
    @Autowired CloudDraftService drafts;
    @Autowired JdbcTemplate jdbc;
    @Autowired S3Client s3;
    MockMvc mvc;UUID owner,other,epoch,id,asset;byte[] bytes;
    static final ObjectMapper JSON=new ObjectMapper();
    @BeforeEach void setup() throws Exception {
        org.mockito.Mockito.when(limits.preHandle(org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any())).thenReturn(true);
        mvc=MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        if(s3.listBuckets().buckets().stream().noneMatch(b -> b.name().equals("export-tests")))s3.createBucket(b -> b.bucket("export-tests"));
        owner=user();other=user();id=UUID.randomUUID();asset=UUID.randomUUID();bytes=wav((byte)1);
    }
    @AfterEach void cleanup(){jdbc.update("UPDATE cloud_audio_assets SET owner_id=NULL,lease_until=NULL,cleanup_after=now() WHERE owner_id IN (?,?)",owner,other);files.cleanup();}
    @Test void audioRequiresItsOwnConsentAndOldPreferenceReceiptsStayReplayable() throws Exception {
        var input=new Preferences(UUID.randomUUID(),0,true,false);epoch=drafts.preferences(owner,input).epoch();
        assertThat(drafts.settings(owner).audioEnabled()).isFalse();
        reserve(asset,id,bytes,409);drafts.audioPreferences(owner,new AudioPreferences(UUID.randomUUID(),1,true));
        assertThat(drafts.preferences(owner,input).audioEnabled()).isTrue();reserve(asset,id,bytes,200);
        drafts.preferences(owner,new Preferences(UUID.randomUUID(),2,false,false));
        assertThat(drafts.settings(owner).audioEnabled()).isFalse();reserve(UUID.randomUUID(),id,bytes,409);
    }
    @Test void verifiedImmutableFileIsPrivateAndRequiresAConfirmedDraftReference() throws Exception {
        enable();reserve(asset,id,bytes,200);
        mvc.perform(get(path(asset))).andExpect(status().isUnauthorized());
        mvc.perform(get(path(asset)).with(as(other))).andExpect(status().isNotFound());
        mvc.perform(put(path(asset)+"/file").with(as(other)).contentType("audio/wav").content(bytes)).andExpect(status().isNotFound());
        upload(asset,bytes,"audio/wav",200);
        mvc.perform(get(path(asset)+"/file").with(as(owner))).andExpect(status().isNotFound());
        write(id,asset,0,1);
        var response=mvc.perform(get(path(asset)+"/file").with(as(owner))).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store")).andReturn().getResponse();
        assertThat(response.getContentAsByteArray()).isEqualTo(bytes);
        upload(asset,wav((byte)2),"audio/wav",200); // A replay never overwrites the confirmed immutable object.
        assertThat(mvc.perform(get(path(asset)+"/file").with(as(owner))).andReturn().getResponse().getContentAsByteArray()).isEqualTo(bytes);
        assertThat(mvc.perform(get(path(asset)).with(as(owner))).andReturn().getResponse().getContentAsString()).doesNotContain("private-draft-audio","objectKey","owner");
        mvc.perform(get(path(asset)+"/file").with(as(other))).andExpect(status().isNotFound());
        assertThatThrownBy(() -> context.getBean(me.yeonjae.tonebridge.application.port.out.StoragePort.class).generatePresignedDownloadUrl(objectKey(asset),java.time.Duration.ofMinutes(1))).isInstanceOf(ToneBridgeException.class);
    }
    @Test void sizeHashAndContainerMismatchNeverPublishAFile() throws Exception {
        enable();reserve(asset,id,bytes,200);upload(asset,Arrays.copyOf(bytes,bytes.length-1),"audio/wav",400);
        UUID wrongHash=UUID.randomUUID();reserve(wrongHash,id,bytes,200);upload(wrongHash,wav((byte)2),"audio/wav",400);
        UUID wrongType=UUID.randomUUID();reserve(wrongType,id,bytes,200);upload(wrongType,bytes,"audio/webm",400);
        UUID badMagic=UUID.randomUUID();byte[] invalid=new byte[64];reserve(badMagic,id,invalid,200);upload(badMagic,invalid,"audio/wav",400);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM cloud_audio_assets WHERE owner_id=? AND state='READY'",Integer.class,owner)).isZero();
        assertThatThrownBy(() -> drafts.write(owner,id,new Write(UUID.randomUUID(),epoch,0,"recording","audio:compose",value(asset,1)))).isInstanceOf(ToneBridgeException.class);
    }
    @Test void concurrentReservationsCannotExceedAccountQuotaAndOversizeIsRejected() throws Exception {
        enable();var start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(3)) {
            List<Future<Integer>> requests=new ArrayList<>();
            for(int i=0;i<3;i++)requests.add(pool.submit(() -> {start.await();try{files.reserve(owner,UUID.randomUUID(),new CloudAudioFiles.Reservation(epoch,UUID.randomUUID(),CloudAudioFiles.MAX_FILE,"audio/wav","0".repeat(64)));return 200;}catch(ToneBridgeException e){return e.getErrorCode().getStatus().value();}}));
            start.countDown();List<Integer> statuses=new ArrayList<>();for(var request:requests)statuses.add(request.get(15,TimeUnit.SECONDS));assertThat(statuses).containsExactlyInAnyOrder(200,200,413);
        }
        assertThat(jdbc.queryForObject("SELECT sum(byte_size) FROM cloud_audio_assets WHERE owner_id=?",Long.class,owner)).isEqualTo(CloudAudioFiles.MAX_ACCOUNT);
        mvc.perform(put(path(UUID.randomUUID())).with(as(owner)).contentType("application/json").content(JSON.writeValueAsString(new CloudAudioFiles.Reservation(epoch,id,CloudAudioFiles.MAX_FILE+1,"audio/wav","0".repeat(64))))).andExpect(status().isBadRequest());
    }
    @Test void concurrentUploadAndStoppedConsentPreserveLocalRetryWithoutPublishing() throws Exception {
        enable();reserve(asset,id,bytes,200);var started=new CountDownLatch(1);var release=new CountDownLatch(1);
        InputStream stalled=new ByteArrayInputStream(bytes){@Override public synchronized int read(byte[] b,int off,int len){started.countDown();try{release.await(10,TimeUnit.SECONDS);}catch(InterruptedException e){throw new RuntimeException(e);}return super.read(b,off,len);}};
        try(var pool=Executors.newSingleThreadExecutor()) {
            var upload=pool.submit(() -> files.upload(owner,asset,stalled,"audio/wav",bytes.length));
            assertThat(started.await(10,TimeUnit.SECONDS)).isTrue();
            upload(asset,bytes,"audio/wav",409);
            drafts.audioPreferences(owner,new AudioPreferences(UUID.randomUUID(),2,false));release.countDown();
            assertThatThrownBy(() -> upload.get(15,TimeUnit.SECONDS)).hasCauseInstanceOf(ToneBridgeException.class);
        }
        assertThat(files.info(owner,asset).state()).isEqualTo("DELETING");
        assertThatThrownBy(() -> s3.headObject(b -> b.bucket("export-tests").key(objectKey(asset)))).isInstanceOf(software.amazon.awssdk.services.s3.model.S3Exception.class);
    }
    @Test void historyReferencesKeepOldFilesAndPruningMakesThemCollectible() throws Exception {
        enable();ready(asset,id,bytes);write(id,asset,0,1);UUID second=UUID.randomUUID();ready(second,id,wav((byte)2));write(id,second,1,2);
        ageFiles();files.cleanup();assertExists(asset);assertExists(second);
        drafts.restore(owner,id,1,new Change(UUID.randomUUID(),epoch,2));assertThat(drafts.get(owner,id).value().get("assetId")).isEqualTo(asset.toString());
        for(int v=4;v<=24;v++)write(id,second,v-1,v);
        assertThat(drafts.history(owner,id)).hasSize(20);ageFiles();files.cleanup();assertMissing(asset);assertExists(second);
        assertThat(jdbc.queryForObject("SELECT sum(byte_size) FROM cloud_audio_assets WHERE owner_id=? AND state<>'DELETED'",Long.class,owner)).isEqualTo((long)bytes.length);
    }
    @Test void deleteAndEraseRevokeDownloadsAndCleanObjectsButStoppingPreservesThem() throws Exception {
        enable();ready(asset,id,bytes);write(id,asset,0,1);
        drafts.audioPreferences(owner,new AudioPreferences(UUID.randomUUID(),2,false));
        mvc.perform(get(path(asset)+"/file").with(as(owner))).andExpect(status().isOk());
        drafts.delete(owner,id,new Change(UUID.randomUUID(),epoch,1));
        mvc.perform(get(path(asset)+"/file").with(as(owner))).andExpect(status().isNotFound());
        ageFiles();files.cleanup();assertMissing(asset);
        drafts.audioPreferences(owner,new AudioPreferences(UUID.randomUUID(),3,true));
        id=UUID.randomUUID();asset=UUID.randomUUID();ready(asset,id,bytes);write(id,asset,0,1);
        drafts.preferences(owner,new Preferences(UUID.randomUUID(),4,false,true));
        jdbc.update("UPDATE cloud_audio_assets SET lease_until=NULL,cleanup_after=now() WHERE owner_id=?",owner);files.cleanup();assertMissing(asset);
    }
    @Test void accountDeletionKeepsCleanupMetadataUntilActualObjectDeletion() throws Exception {
        enable();ready(asset,id,bytes);write(id,asset,0,1);String key=objectKey(asset);
        jdbc.update("DELETE FROM users WHERE id=?",owner);
        assertThat(jdbc.queryForObject("SELECT owner_id IS NULL FROM cloud_audio_assets WHERE id=?",Boolean.class,asset)).isTrue();
        mvc.perform(get(path(asset)+"/file").with(as(owner))).andExpect(status().isNotFound());
        jdbc.update("UPDATE cloud_audio_assets SET lease_until=NULL WHERE id=?",asset);files.cleanup();
        assertThatThrownBy(() -> s3.headObject(b -> b.bucket("export-tests").key(key))).isInstanceOf(software.amazon.awssdk.services.s3.model.S3Exception.class);
        assertThat(jdbc.queryForObject("SELECT state FROM cloud_audio_assets WHERE id=?",String.class,asset)).isEqualTo("DELETED");
    }
    @Test void ownerCannotAttachAnotherOwnersVerifiedAudioOrAnExpiredReservation() throws Exception {
        enable();ready(asset,id,bytes);
        var otherSettings=drafts.preferences(other,new Preferences(UUID.randomUUID(),0,true,false));drafts.audioPreferences(other,new AudioPreferences(UUID.randomUUID(),1,true));
        assertThatThrownBy(() -> drafts.write(other,UUID.randomUUID(),new Write(UUID.randomUUID(),otherSettings.epoch(),0,"recording","audio:compose",value(asset,1)))).isInstanceOf(ToneBridgeException.class);
        UUID expired=UUID.randomUUID();reserve(expired,id,bytes,200);jdbc.update("UPDATE cloud_audio_assets SET expires_at=now()-interval '1 second' WHERE id=?",expired);upload(expired,bytes,"audio/wav",409);
        files.cleanup();assertThat(files.info(owner,expired).state()).isEqualTo("DELETED");
    }
    @Test void audioAndTextShareOnePendingIdentityAndExpiryCancelsTheWholeClaim() throws Exception {
        enable();ready(asset,id,bytes);write(id,asset,0,1);
        UUID text=UUID.randomUUID(),operation=UUID.randomUUID();var editor=new LinkedHashMap<String,Object>();editor.put("kind","TEXT");editor.put("destination","PERSONAL");editor.put("selectedFriendId","");editor.put("targetLanguage","en");editor.put("contentText","Text context");editor.put("context","");editor.put("selectedGoals",List.of());editor.put("step",0);
        drafts.write(owner,text,new Write(UUID.randomUUID(),epoch,0,"editor","compose",editor));
        var prepare=new Prepare(epoch,1,operation,"COMPOSITION",Map.of("kind","AUDIO"));drafts.prepare(owner,text,prepare);drafts.prepare(owner,id,prepare);
        assertThat(drafts.get(owner,id).pendingOperation()).isEqualTo(operation);
        jdbc.update("UPDATE cloud_drafts SET expires_at=now()-interval '1 second' WHERE owner_id=? AND id=?",owner,id);drafts.cleanOwner(owner);
        assertThat(drafts.get(owner,text).pendingOperation()).isNull();
        assertThat(jdbc.queryForObject("SELECT cancelled FROM composition_receipts WHERE owner_id=? AND operation_id=?",Boolean.class,owner,operation)).isTrue();
    }
    @Autowired me.yeonjae.tonebridge.application.service.PersonalExportData exports;
    @Test void exportIncludesOwnedCloudAudioOnceWithoutPrivateObjectKeysAndRevokesAfterDelete() throws Exception {
        enable();ready(asset,id,bytes);write(id,asset,0,1);write(id,asset,1,2);
        var snapshot=exports.snapshot(owner,true);
        assertThat(snapshot.audio()).hasSize(1);
        assertThat(JSON.writeValueAsString(snapshot.data())).doesNotContain("private-draft-audio/").contains("audioFile");
        assertThat(exports.snapshot(owner,false).audio()).isEmpty();
        drafts.delete(owner,id,new Change(UUID.randomUUID(),epoch,2));
        assertThatThrownBy(() -> exports.verify(owner,snapshot.checks())).isInstanceOf(ToneBridgeException.class);
    }
    @Autowired me.yeonjae.tonebridge.application.port.out.PrivateFilePort privateFiles;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
    @Test void failedCleanupRetainsTheKeyAndALaterAttemptActuallyDeletesTheObject() throws Exception {
        enable();ready(asset,id,bytes);write(id,asset,0,1);drafts.delete(owner,id,new Change(UUID.randomUUID(),epoch,1));ageFiles();
        var failing=org.mockito.Mockito.mock(me.yeonjae.tonebridge.application.port.out.PrivateFilePort.class,org.mockito.AdditionalAnswers.delegatesTo(privateFiles));
        org.mockito.Mockito.doThrow(new IllegalStateException("storage unavailable")).when(failing).delete(objectKey(asset));
        new CloudAudioFiles(jdbc,failing,transactions).cleanup();assertExists(asset);
        assertThat(files.info(owner,asset).state()).isEqualTo("DELETING");
        jdbc.update("UPDATE cloud_audio_assets SET cleanup_after=now() WHERE id=?",asset);files.cleanup();assertMissing(asset);
        // A late storage completion cannot permanently resurrect an unreferenced object.
        s3.putObject(b -> b.bucket("export-tests").key(objectKey(asset)),software.amazon.awssdk.core.sync.RequestBody.fromBytes(bytes));
        jdbc.update("UPDATE cloud_audio_assets SET cleanup_after=now() WHERE id=?",asset);files.cleanup();assertMissing(asset);
    }
    @Test void activeDraftLimitIncludesTextButAllowsReplacingAnExistingRecording() throws Exception {
        enable();ready(asset,id,bytes);write(id,asset,0,1);
        for(int i=0;i<49;i++)jdbc.update("INSERT INTO cloud_drafts(owner_id,id,kind,scope,version,state,value,expires_at) VALUES (?,?,'editor','compose',1,'ACTIVE','{}',now()+interval '7 days')",owner,UUID.randomUUID());
        reserve(UUID.randomUUID(),UUID.randomUUID(),bytes,413);
        reserve(UUID.randomUUID(),id,wav((byte)2),200);
    }
    private void enable(){epoch=drafts.preferences(owner,new Preferences(UUID.randomUUID(),0,true,false)).epoch();drafts.audioPreferences(owner,new AudioPreferences(UUID.randomUUID(),1,true));}
    private void reserve(UUID asset,UUID draft,byte[] data,int status) throws Exception {mvc.perform(put(path(asset)).with(as(owner)).contentType("application/json").content(JSON.writeValueAsString(new CloudAudioFiles.Reservation(epoch,draft,data.length,"audio/wav",sha(data))))).andExpect(status().is(status));}
    private void upload(UUID asset,byte[] data,String type,int status) throws Exception {mvc.perform(put(path(asset)+"/file").with(as(owner)).contentType(type).content(data)).andExpect(status().is(status));}
    private void ready(UUID asset,UUID draft,byte[] data) throws Exception {reserve(asset,draft,data,200);upload(asset,data,"audio/wav",200);}
    private void write(UUID draft,UUID asset,long version,double duration){drafts.write(owner,draft,new Write(UUID.randomUUID(),epoch,version,"recording","audio:compose",value(asset,duration)));}
    private static Map<String,Object> value(UUID asset,double duration){return Map.of("assetId",asset.toString(),"duration",duration);}
    private static byte[] wav(byte value){byte[] bytes=new byte[64];Arrays.fill(bytes,value);System.arraycopy("RIFF".getBytes(),0,bytes,0,4);System.arraycopy("WAVE".getBytes(),0,bytes,8,4);return bytes;}
    private static String sha(byte[] data) throws Exception{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data));}
    private String objectKey(UUID id){return jdbc.queryForObject("SELECT object_key FROM cloud_audio_assets WHERE id=?",String.class,id);}
    private void ageFiles(){jdbc.update("UPDATE cloud_audio_assets SET expires_at=now()-interval '1 second',lease_until=NULL,cleanup_after=now() WHERE owner_id=?",owner);}
    private void assertExists(UUID id){assertThat(s3.headObject(b -> b.bucket("export-tests").key(objectKey(id))).contentLength()).isPositive();}
    private void assertMissing(UUID id){assertThatThrownBy(() -> s3.headObject(b -> b.bucket("export-tests").key(objectKey(id)))).isInstanceOf(software.amazon.awssdk.services.s3.model.S3Exception.class);}
    private UUID user(){UUID id=UUID.randomUUID();jdbc.update("INSERT INTO users(id,email,username,native_language) VALUES (?,?,?,'en')",id,id+"@test.invalid","u"+id.toString().substring(0,8));return id;}
    private static String path(UUID id){return "/api/users/me/draft-audio/"+id;}
    private static RequestPostProcessor as(UUID id){return authentication(new UsernamePasswordAuthenticationToken(id,null,List.of(new SimpleGrantedAuthority("ROLE_USER"))));}
}
