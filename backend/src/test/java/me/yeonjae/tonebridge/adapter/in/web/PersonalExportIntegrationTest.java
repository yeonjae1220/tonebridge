package me.yeonjae.tonebridge.adapter.in.web;

import me.yeonjae.tonebridge.support.PostgresIntegrationTest;
import me.yeonjae.tonebridge.application.service.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.core.sync.RequestBody;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties="tonebridge.exports.scheduler-enabled=false")
class PersonalExportIntegrationTest extends PostgresIntegrationTest {
    static final GenericContainer<?> MINIO=new GenericContainer<>(new org.testcontainers.images.builder.ImageFromDockerfile("tonebridge-minio-export-test:2025-04-08", false)
            .withFileFromClasspath("Dockerfile", "minio/Dockerfile"))
            .withEnv("MINIO_ROOT_USER","exportfixture").withEnv("MINIO_ROOT_PASSWORD","fixture-only-password")
            .withCommand("server","/data").withExposedPorts(9000).waitingFor(Wait.forHttp("/minio/health/ready").forPort(9000));
    static { MINIO.start(); }
    @DynamicPropertySource static void storage(DynamicPropertyRegistry properties) {
        properties.add("tonebridge.storage.endpoint",() -> "http://"+MINIO.getHost()+":"+MINIO.getMappedPort(9000));
        properties.add("tonebridge.storage.access-key",() -> "exportfixture");
        properties.add("tonebridge.storage.secret-key",() -> "fixture-only-password");
        properties.add("tonebridge.storage.bucket",() -> "export-tests");
        properties.add("tonebridge.storage.region",() -> "us-east-1");
    }
    @org.springframework.test.context.bean.override.mockito.MockitoBean
    me.yeonjae.tonebridge.shared.config.StorageRateLimitInterceptor storageLimits;
    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired PersonalExportWorker worker;
    @Autowired PersonalExportJobs jobs;
    @Autowired AudioOwnershipService ownership;
    @Autowired UserBlockService blocks;
    @Autowired S3Client s3;
    MockMvc mvc;
    UUID owner,peer,request,correction,operation;
    String audioKey;
    @BeforeEach void setup() throws Exception {
        org.mockito.Mockito.when(storageLimits.preHandle(org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any())).thenReturn(true);
        mvc=MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        if(s3.listBuckets().buckets().stream().noneMatch(b -> b.name().equals("export-tests"))) s3.createBucket(b -> b.bucket("export-tests"));
        owner=user();peer=user();request=UUID.randomUUID();correction=UUID.randomUUID();operation=UUID.randomUUID();audioKey="audio/"+owner+"/owned.webm";
        jdbc.update("INSERT INTO correction_requests(id,requester_id,type,content_text,target_language,status,credit_cost,audio_url) VALUES (?,?,'TEXT','My original','en','PENDING',0,?)",request,owner,audioKey);
        jdbc.update("INSERT INTO corrections(id,request_id,corrector_id,corrected_text,explanation) VALUES (?,?,?,'Received correction','Helpful private explanation')",correction,request,peer);
        jdbc.update("UPDATE users SET password_hash='must-not-export-password-hash' WHERE id=?",owner);
    }
    @AfterEach void cleanup() {
        jdbc.update("UPDATE personal_exports SET owner_id=NULL WHERE owner_id IN (?,?)",owner,peer);
        worker.cleanup();
    }
    @Test void authenticatedOwnedArchiveContainsWhitelistedRecordsAndRealAudio() throws Exception {
        ownership.register(owner,audioKey);
        byte[] audio="fixture audio bytes".getBytes(StandardCharsets.UTF_8);
        s3.putObject(b -> b.bucket("export-tests").key(audioKey).contentType("audio/webm"),RequestBody.fromBytes(audio));
        create(owner,operation,true,202);worker.processOne();
        mvc.perform(get(path(operation)).with(as(owner))).andExpect(status().isOk()).andExpect(jsonPath("$.state").value("READY")).andExpect(jsonPath("$.checks").doesNotExist()).andExpect(jsonPath("$.owner").doesNotExist());
        var response=mvc.perform(get(path(operation)+"/download").with(as(owner))).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store")).andReturn().getResponse();
        var zip=unzip(response.getContentAsByteArray());
        assertThat(zip.keySet()).containsExactlyInAnyOrder("records.json","README.txt","audio/1.webm");
        assertThat(zip.get("audio/1.webm")).isEqualTo(audio);
        String json=new String(zip.get("records.json"),StandardCharsets.UTF_8);
        assertThat(json).contains("My original","Received correction",owner+"@test.invalid").doesNotContain(peer+"@test.invalid","must-not-export-password-hash",audioKey,"accessToken","refreshToken","password_hash");
    }
    @Test void unknownOrAnotherUploadOwnersAudioIsExplicitlyOmitted() throws Exception {
        ownership.register(peer,audioKey);
        create(owner,operation,true,202);worker.processOne();
        var zip=unzip(mvc.perform(get(path(operation)+"/download").with(as(owner))).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray());
        assertThat(zip).hasSize(2);
        assertThat(new String(zip.get("records.json"),StandardCharsets.UTF_8)).contains("ownership_not_recorded").doesNotContain(audioKey);
    }
    @Test void authenticationAndOwnerScopeApplyToStatusAndDownload() throws Exception {
        create(owner,operation,false,202);worker.processOne();
        mvc.perform(get("/api/users/me/exports")).andExpect(status().isUnauthorized());
        mvc.perform(get(path(operation))).andExpect(status().isUnauthorized());
        mvc.perform(get(path(operation)+"/download").with(as(peer))).andExpect(status().isNotFound());
        mvc.perform(get(path(operation)).with(as(peer))).andExpect(status().isNotFound());
        mvc.perform(get("/api/users/me/exports").with(as(peer))).andExpect(jsonPath("$.length()").value(0));
        create(peer,operation,false,409);
    }
    @Test void lostResponseAndConcurrentRetriesProduceOneJob() throws Exception {
        var start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var first=pool.submit(() -> {start.await();return create(owner,operation,false,202);});
            var second=pool.submit(() -> {start.await();return create(owner,operation,false,202);});
            start.countDown();assertThat(first.get(15,TimeUnit.SECONDS)).isEqualTo(second.get(15,TimeUnit.SECONDS));
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM personal_exports WHERE owner_id=?",Integer.class,owner)).isEqualTo(1);
        create(owner,operation,true,409);create(owner,UUID.randomUUID(),false,429);
        worker.processOne();create(owner,operation,false,202);
    }
    @Test void blockAfterCreationRevokesBorrowedFeedbackArchiveDownload() throws Exception {
        create(owner,operation,false,202);worker.processOne();blocks.block(owner,peer);
        mvc.perform(get(path(operation)+"/download").with(as(owner))).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EXPORT_002"));
        UUID fresh=UUID.randomUUID();create(owner,fresh,false,202);worker.processOne();
        String json=new String(unzip(mvc.perform(get(path(fresh)+"/download").with(as(owner))).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray()).get("records.json"),StandardCharsets.UTF_8);
        assertThat(json).doesNotContain("Received correction").contains("My original");
    }
    @Test void expiryDeniesDownloadAndDeletesPrivateArtifact() throws Exception {
        create(owner,operation,false,202);worker.processOne();
        jdbc.update("UPDATE personal_exports SET expires_at=now()-interval '1 second' WHERE id=?",operation);
        mvc.perform(get(path(operation)+"/download").with(as(owner))).andExpect(status().isConflict());
        worker.cleanup();
        assertThat(jobs.get(owner,operation).state()).isEqualTo("EXPIRED");
        assertThat(s3.listObjectsV2(b -> b.bucket("export-tests").prefix(PersonalExportWorker.key(operation))).keyCount()).isZero();
    }
    @Test void missingOwnedAudioFailsInsteadOfSilentlyProducingPartialZip() throws Exception {
        ownership.register(owner,audioKey);create(owner,operation,true,202);worker.processOne();
        assertThat(jobs.get(owner,operation).state()).isEqualTo("FAILED");
        mvc.perform(get(path(operation)+"/download").with(as(owner))).andExpect(status().isConflict());
        worker.cleanup();assertThat(s3.listObjectsV2(b -> b.bucket("export-tests").prefix(PersonalExportWorker.key(operation))).keyCount()).isZero();
    }
    @Test void deletedAccountLosesDownloadAndRetainsCleanupMetadata() throws Exception {
        UUID empty=user(),id=UUID.randomUUID();create(empty,id,false,202);worker.processOne();
        jdbc.update("DELETE FROM users WHERE id=?",empty);
        mvc.perform(get(path(id)+"/download").with(as(empty))).andExpect(status().isNotFound());
        worker.cleanup();
        assertThat(s3.listObjectsV2(b -> b.bucket("export-tests").prefix(PersonalExportWorker.key(id))).keyCount()).isZero();
        assertThat(jdbc.queryForObject("SELECT artifact_deleted FROM personal_exports WHERE id=?",Boolean.class,id)).isTrue();
    }
    @Test void hourlyLimitStillAppliesAfterCompletedJobs() throws Exception {
        create(owner,operation,false,202);worker.processOne();
        create(owner,UUID.randomUUID(),false,202);worker.processOne();
        create(owner,UUID.randomUUID(),false,429);
    }
    @Test void recordLimitFailsClearlyWithoutTruncatedSuccess() throws Exception {
        jdbc.update("INSERT INTO correction_requests(requester_id,type,content_text,target_language,status,credit_cost) SELECT ?,'TEXT','record','en','PENDING',0 FROM generate_series(1,10001)",owner);
        create(owner,operation,false,202);worker.processOne();
        assertThat(jobs.get(owner,operation).state()).isEqualTo("FAILED");
        assertThat(jobs.get(owner,operation).failureCode()).isEqualTo("EXPORT_LIMIT");
    }
    @Test void realPrivateStorageRejectsOversizedReads() {
        var port=context.getBean(me.yeonjae.tonebridge.application.port.out.PrivateFilePort.class);
        s3.putObject(b -> b.bucket("export-tests").key(audioKey),RequestBody.fromBytes(new byte[100]));
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> port.open(audioKey,10)).isInstanceOf(IllegalStateException.class);
    }
    @Test void privateArchiveCannotBeSignedThroughTheGenericAudioApi() throws Exception {
        create(owner,operation,false,202);worker.processOne();
        mvc.perform(get("/api/storage/presigned-download").param("key",PersonalExportWorker.key(operation)).with(as(owner))).andExpect(status().isBadRequest());
    }
    @Test void interruptedWorkerLeaseCannotPublishALateArchive() throws Exception {
        create(owner,operation,false,202);
        var claimed=jobs.claim().orElseThrow();
        jdbc.update("UPDATE personal_exports SET started_at=now()-interval '11 minutes' WHERE id=?",operation);
        worker.cleanup();
        assertThat(jobs.get(owner,operation).state()).isEqualTo("FAILED");
        assertThat(jobs.complete(claimed,10,"{}")).isFalse();
        // An upload completing after the first cleanup pass must be deleted on retry.
        s3.putObject(b -> b.bucket("export-tests").key(PersonalExportWorker.key(operation)),RequestBody.fromBytes(new byte[10]));
        jobs.needsCleanup(operation);worker.cleanup();
        assertThat(s3.listObjectsV2(b -> b.bucket("export-tests").prefix(PersonalExportWorker.key(operation))).keyCount()).isZero();
    }
    @Test void downloadsAreBoundedAndDeletingReceivedFeedbackRevokesTheSnapshot() throws Exception {
        create(owner,operation,false,202);worker.processOne();
        jdbc.update("UPDATE personal_exports SET download_count=20 WHERE id=?",operation);
        mvc.perform(get(path(operation)+"/download").with(as(owner))).andExpect(status().isTooManyRequests());
        jdbc.update("UPDATE personal_exports SET download_count=0 WHERE id=?",operation);
        jdbc.update("UPDATE corrections SET deleted_at=now() WHERE id=?",correction);
        mvc.perform(get(path(operation)+"/download").with(as(owner))).andExpect(status().isConflict());
    }
    private String create(UUID who,UUID id,boolean audio,int expected) throws Exception {
        return mvc.perform(post("/api/users/me/exports").with(as(who)).contentType(MediaType.APPLICATION_JSON).content("{\"operationId\":\""+id+"\",\"includeAudio\":"+audio+"}"))
                .andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();
    }
    private static String path(UUID id) {return "/api/users/me/exports/"+id;}
    private static Map<String,byte[]> unzip(byte[] bytes) throws IOException {
        Map<String,byte[]> result=new LinkedHashMap<>();try(var zip=new ZipInputStream(new ByteArrayInputStream(bytes))) {ZipEntry entry;while((entry=zip.getNextEntry())!=null) result.put(entry.getName(),zip.readAllBytes());}return result;
    }
    private UUID user() {UUID id=UUID.randomUUID();jdbc.update("INSERT INTO users(id,email,username,native_language) VALUES (?,?,?,'en')",id,id+"@test.invalid","u"+id.toString().substring(0,8));return id;}
    private static RequestPostProcessor as(UUID user) {return authentication(new UsernamePasswordAuthenticationToken(user,null,List.of(new SimpleGrantedAuthority("ROLE_USER"))));}
}
