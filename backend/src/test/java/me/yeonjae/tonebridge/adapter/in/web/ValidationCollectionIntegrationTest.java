package me.yeonjae.tonebridge.adapter.in.web;

import me.yeonjae.tonebridge.adapter.out.persistence.*;
import me.yeonjae.tonebridge.shared.event.*;
import me.yeonjae.tonebridge.shared.util.JwtProvider;
import me.yeonjae.tonebridge.support.PostgresIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@TestPropertySource(properties = "tonebridge.validation.enabled=true")
class ValidationCollectionIntegrationTest extends PostgresIntegrationTest {
    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired JwtProvider jwt;
    @Autowired ApplicationEventPublisher publisher;
    @Autowired PlatformTransactionManager transactions;
    @Autowired ValidationCollectionPolicy policy;
    @Autowired ValidationDiagnosticRecorder diagnostics;
    @Autowired LearningActivityRecorder activity;
    MockMvc mvc;
    UUID a,b,session,card;

    @BeforeEach void setup() {
        mvc=MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        a=user(); b=user(); session=UUID.randomUUID(); card=UUID.randomUUID();
        jdbc.update("DELETE FROM validation_diagnostic_daily");
        jdbc.update("INSERT INTO study_sessions (id,created_by) VALUES (?,?)",session,a);
        jdbc.update("INSERT INTO session_members (session_id,user_id) VALUES (?,?),(?,?)",session,a,session,b);
        jdbc.update("INSERT INTO study_cards (id,session_id,created_by_user_id,phrase) VALUES (?,?,?,'fixture')",card,session,a);
    }

    @Test void learningStillWorksWithoutEnrollmentAndRequiresAllSharedMembers() throws Exception {
        practise(b); assertThat(activityCount()).isZero();
        enroll(b); practise(b); assertThat(activityCount()).isZero();
        enroll(a); practise(b); assertThat(activityCount()).isEqualTo(1);
        UUID third=user();
        jdbc.update("INSERT INTO session_members (session_id,user_id) VALUES (?,?)",session,third);
        practise(b); assertThat(activityCount()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM learner_attempts WHERE card_id=?",Long.class,card)).isEqualTo(4);
    }

    @Test void retryingAnExistingRecordingDoesNotCollectRetroactivelyOrDoubleCount() throws Exception {
        String beforeEnrollment=UUID.randomUUID()+".webm";
        practise(b,beforeEnrollment);
        enroll(a); enroll(b);
        practise(b,beforeEnrollment);
        assertThat(activityCount()).isZero();
        String afterEnrollment=UUID.randomUUID()+".webm";
        practise(b,afterEnrollment);
        practise(b,afterEnrollment);
        assertThat(activityCount()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM learner_attempts WHERE card_id=?",Long.class,card)).isEqualTo(2);
    }

    @Test void friendAcceptanceRequiresBothSubjectsAndPersonalActivityNeedsOnlyItsOwner() {
        enroll(a);
        publish(new LearningActivity(LearningActivity.Kind.FRIEND_ACCEPTED,a,b,null,null,null));
        assertThat(friendCount()).isZero();
        enroll(b);
        publish(new LearningActivity(LearningActivity.Kind.FRIEND_ACCEPTED,a,b,null,null,null));
        assertThat(friendCount()).isEqualTo(1);
        jdbc.update("DELETE FROM session_members WHERE session_id=? AND user_id=?",session,b);
        jdbc.update("UPDATE validation_participants SET revoked_at=now() WHERE user_id=?",b);
        publish(new LearningActivity(LearningActivity.Kind.PRACTICE_SAVED,a,null,session,card,UUID.randomUUID()));
        assertThat(activityCount()).isEqualTo(1);
    }

    @Test void actualJwtIdentityControlsDiagnosticsAndNoReadOrEnrollmentApiIsExposed() throws Exception {
        enroll(a);
        mvc.perform(post("/api/validation/diagnostics").contentType(APPLICATION_JSON)
                .content("{\"event\":\"UPLOAD_SUCCEEDED\"}")).andExpect(status().isUnauthorized());
        diagnostic(b,"UPLOAD_SUCCEEDED",",\"userId\":\""+a+"\"");
        assertThat(total()).isZero();
        diagnostic(a,"UPLOAD_SUCCEEDED","");
        assertThat(total()).isEqualTo(1);
        diagnostic(b,"UPLOAD_SUCCEEDED",""); // account switch uses the replacement account's eligibility
        assertThat(total()).isEqualTo(1);
        mvc.perform(post("/api/validation/diagnostics").header("Authorization",token(a)).contentType(APPLICATION_JSON)
                .content("{\"event\":\"private-content\"}")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/validation/diagnostics").header("Authorization",token(a)))
                .andExpect(status().isMethodNotAllowed());
        mvc.perform(post("/api/validation/participants").header("Authorization",token(a)))
                .andExpect(status().isNotFound());
        assertThat(jdbc.queryForList("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name='validation_diagnostic_daily' ORDER BY ordinal_position
                """,String.class)).containsExactly("day","event","total");
    }

    @Test void futureExpiredAndRevokedAccountsNeverCollect() throws Exception {
        enroll(a); enroll(b);
        jdbc.update("UPDATE validation_participants SET starts_at=now()+interval '1 day',ends_at=now()+interval '2 days' WHERE user_id=?",a);
        practise(a); diagnostic(a,"RECORDING_FAILED","");
        jdbc.update("UPDATE validation_participants SET acknowledged_at=now()-interval '3 days',starts_at=now()-interval '2 days',ends_at=now()-interval '1 day' WHERE user_id=?",a);
        practise(a); diagnostic(a,"RECORDING_FAILED","");
        jdbc.update("UPDATE validation_participants SET starts_at=now()-interval '1 day',ends_at=now()+interval '1 day',revoked_at=now() WHERE user_id=?",a);
        practise(a); diagnostic(a,"RECORDING_FAILED","");
        assertThat(activityCount()).isZero(); assertThat(total()).isZero();
    }

    @Test void concurrentUpsertsSurviveNewRecorderInstanceAndReportUtcBuckets() throws Exception {
        enroll(a);
        ExecutorService pool=Executors.newFixedThreadPool(6);
        try {
            List<Callable<ValidationDiagnosticRecorder.Result>> calls=new ArrayList<>();
            for (int i=0;i<30;i++) calls.add(() -> diagnostics.record(a,ValidationDiagnostic.UPLOAD_SUCCEEDED));
            for (var result:pool.invokeAll(calls)) assertThat(result.get()).isEqualTo(ValidationDiagnosticRecorder.Result.RECORDED);
        } finally { pool.shutdownNow(); }
        // No state is restored from the original singleton; a freshly created recorder writes the same DB bucket.
        var recreated=new ValidationDiagnosticRecorder(jdbc,policy);
        new TransactionTemplate(transactions).executeWithoutResult(tx -> {
            jdbc.execute("SET LOCAL TIME ZONE 'Pacific/Honolulu'");
            assertThat(recreated.record(a,ValidationDiagnostic.UPLOAD_SUCCEEDED)).isEqualTo(ValidationDiagnosticRecorder.Result.RECORDED);
        });
        assertThat(total()).isEqualTo(31);
        var day=jdbc.queryForObject("SELECT (now() AT TIME ZONE 'UTC')::date",java.sql.Date.class);
        assertThat(jdbc.queryForObject("SELECT day FROM validation_diagnostic_daily",java.sql.Date.class)).isEqualTo(day);
        String sql=Files.readString(Path.of("../scripts/validation/diagnostics-report.sql"))
                .replace(":'from_day'","?").replace(":'until_day'","?");
        assertThat(jdbc.queryForMap(sql,day.toString(),day.toLocalDate().plusDays(1).toString()).get("total")).isEqualTo(31L);
    }

    @Test void dailyCleanupWorksWithCollectionDisabledAndAccountDeleteCascadesRegistration() {
        enroll(a);
        jdbc.update("UPDATE validation_participants SET acknowledged_at=now()-interval '40 days',starts_at=now()-interval '40 days',ends_at=now()-interval '32 days' WHERE user_id=?",a);
        jdbc.update("INSERT INTO validation_diagnostic_daily VALUES ((now() AT TIME ZONE 'UTC')::date - 31,'UPLOAD_FAILED',1),((now() AT TIME ZONE 'UTC')::date,'UPLOAD_FAILED',2)");
        var disabled=new LearningActivityRecorder(context.getBean(LearningActivityRepository.class),new ValidationCollectionPolicy(jdbc,false),jdbc);
        new TransactionTemplate(transactions).executeWithoutResult(tx -> disabled.purgeExpired());
        assertThat(total()).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM validation_participants WHERE user_id=?",Long.class,a)).isZero();
        UUID disposable=user(); enroll(disposable);
        jdbc.update("DELETE FROM users WHERE id=?",disposable);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM validation_participants WHERE user_id=?",Long.class,disposable)).isZero();
    }

    @Test void withdrawalSerializesWithPendingWritesAndRemovesSharedActivity() throws Exception {
        enroll(a); enroll(b);
        ExecutorService pool=Executors.newFixedThreadPool(2);
        CountDownLatch held=new CountDownLatch(1),release=new CountDownLatch(1),withdrawing=new CountDownLatch(1);
        try {
            var pending=pool.submit(() -> new TransactionTemplate(transactions).executeWithoutResult(tx -> {
                publisher.publishEvent(new LearningActivity(LearningActivity.Kind.PRACTICE_SAVED,b,null,session,card,UUID.randomUUID()));
                held.countDown();
                try { if (!release.await(10,TimeUnit.SECONDS)) throw new AssertionError("release timeout"); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new RuntimeException(e); }
            }));
            assertThat(held.await(10,TimeUnit.SECONDS)).isTrue();
            var withdrawal=pool.submit(() -> {
                withdrawing.countDown();
                new TransactionTemplate(transactions).executeWithoutResult(tx -> withdraw(a));
            });
            assertThat(withdrawing.await(10,TimeUnit.SECONDS)).isTrue();
            assertThatThrownBy(() -> withdrawal.get(200,TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
            release.countDown(); pending.get(10,TimeUnit.SECONDS); withdrawal.get(10,TimeUnit.SECONDS);
            assertThat(activityCount()).isZero();
            practise(b); diagnostic(a,"UPLOAD_FAILED","");
            assertThat(activityCount()).isZero(); assertThat(total()).isZero();
        } finally { release.countDown(); pool.shutdownNow(); }
    }

    @Test void rateLimitExcludesUnenrolledTrafficAndCapsEligibleWrites() {
        enroll(a);
        var fresh=new ValidationDiagnosticRecorder(jdbc,policy);
        var tx=new TransactionTemplate(transactions);
        for (int i=0;i<605;i++) assertThat(tx.<ValidationDiagnosticRecorder.Result>execute(s -> fresh.record(b,ValidationDiagnostic.UPLOAD_FAILED))).isEqualTo(ValidationDiagnosticRecorder.Result.IGNORED);
        for (int i=0;i<600;i++) assertThat(tx.<ValidationDiagnosticRecorder.Result>execute(s -> fresh.record(a,ValidationDiagnostic.UPLOAD_FAILED))).isEqualTo(ValidationDiagnosticRecorder.Result.RECORDED);
        assertThat(tx.<ValidationDiagnosticRecorder.Result>execute(s -> fresh.record(a,ValidationDiagnostic.UPLOAD_FAILED))).isEqualTo(ValidationDiagnosticRecorder.Result.RATE_LIMITED);
        assertThat(total()).isEqualTo(600);
    }

    @Test void enrollmentScriptDoesNotSilentlyExtendConsentAndInvalidPeriodsAreRejected() throws Exception {
        String script=Files.readString(Path.of("../scripts/validation/enroll.sql"));
        String sql=script.lines().filter(line -> !line.startsWith("--") && !line.startsWith("\\") && !line.equals("BEGIN;") && !line.equals("COMMIT;"))
                .collect(java.util.stream.Collectors.joining("\n"))
                .replace(":'user_id'","'"+a+"'").replace(":'notice_version'","'pilot-v1'")
                .replace(":'acknowledged_at'","'2026-10-29T00:00:00Z'")
                .replace(":'starts_at'","'2026-10-29T00:00:00Z'")
                .replace(":'ends_at'","'2026-11-12T00:00:00Z'");
        new TransactionTemplate(transactions).executeWithoutResult(tx -> jdbc.execute(sql));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM validation_participants WHERE user_id=?",Long.class,a)).isEqualTo(1);
        assertThatThrownBy(() -> new TransactionTemplate(transactions).executeWithoutResult(tx -> jdbc.execute(sql)))
                .isInstanceOf(org.springframework.dao.DuplicateKeyException.class);
        assertThatThrownBy(() -> jdbc.update("UPDATE validation_participants SET ends_at=starts_at+interval '31 days' WHERE user_id=?",a))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("UPDATE validation_participants SET acknowledged_at=starts_at+interval '1 day' WHERE user_id=?",a))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThat(jdbc.queryForObject("SELECT notice_version FROM validation_participants WHERE user_id=?",String.class,a)).isEqualTo("pilot-v1");
    }

    @ParameterizedTest
    @CsvSource({"true,true", "true,false", "false,true", "false,false"})
    void eligibilityIsCheckedAfterLockWait(boolean expiresWhileWaiting, boolean diagnostic) throws Exception {
        enroll(a); enroll(b);
        if (expiresWhileWaiting) jdbc.update("UPDATE validation_participants SET ends_at=clock_timestamp()+interval '2 seconds' WHERE user_id=?",a);
        ExecutorService pool=Executors.newFixedThreadPool(2);
        CountDownLatch locked=new CountDownLatch(1), release=new CountDownLatch(1);
        String applicationName="expiry-review-"+UUID.randomUUID();
        try {
            var holder=pool.submit(() -> new TransactionTemplate(transactions).executeWithoutResult(tx -> {
                jdbc.queryForObject("SELECT user_id FROM validation_participants WHERE user_id=? FOR UPDATE",UUID.class,a);
                locked.countDown();
                try { if (!release.await(10,TimeUnit.SECONDS)) throw new AssertionError("lock release timeout"); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new RuntimeException(e); }
            }));
            assertThat(locked.await(5,TimeUnit.SECONDS)).isTrue();
            var collecting=pool.submit(() -> new TransactionTemplate(transactions).executeWithoutResult(tx -> {
                jdbc.queryForObject("SELECT set_config('application_name',?,true)",String.class,applicationName);
                if (diagnostic) diagnostics.record(a,ValidationDiagnostic.UPLOAD_SUCCEEDED);
                else publisher.publishEvent(new LearningActivity(LearningActivity.Kind.PRACTICE_SAVED,a,null,session,card,UUID.randomUUID()));
            }));
            long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(5);
            while (jdbc.queryForObject("SELECT count(*) FROM pg_stat_activity WHERE application_name=? AND wait_event_type='Lock'",Long.class,applicationName)==0) {
                if (System.nanoTime()>deadline) throw new AssertionError("collector did not wait on participant lock");
                Thread.sleep(10);
            }
            if (expiresWhileWaiting) {
                while (!Boolean.TRUE.equals(jdbc.queryForObject("SELECT clock_timestamp() >= ends_at FROM validation_participants WHERE user_id=?",Boolean.class,a))) {
                    if (System.nanoTime()>deadline) throw new AssertionError("participant did not expire");
                    Thread.sleep(10);
                }
            }
            release.countDown(); holder.get(5,TimeUnit.SECONDS); collecting.get(5,TimeUnit.SECONDS);
            assertThat(diagnostic ? total() : activityCount()).isEqualTo(expiresWhileWaiting ? 0 : 1);
        } finally { release.countDown(); pool.shutdownNow(); }
    }

    private void withdraw(UUID id) {
        try {
            String sql=Files.readString(Path.of("../scripts/validation/withdraw.sql"));
            sql=sql.lines().filter(line -> !line.startsWith("--") && !line.startsWith("\\") && !line.equals("BEGIN;") && !line.equals("COMMIT;")).collect(java.util.stream.Collectors.joining("\n"));
            // UUID is generated by this test; production uses psql literal quoting.
            jdbc.execute(sql.replace(":'user_id'","'"+id+"'"));
        } catch (java.io.IOException e) { throw new RuntimeException(e); }
    }
    private void practise(UUID id) throws Exception {
        practise(id, UUID.randomUUID()+".webm");
    }
    private void practise(UUID id, String audioKey) throws Exception {
        mvc.perform(post("/api/cards/{id}/attempts",card).header("Authorization",token(id)).contentType(APPLICATION_JSON)
                .content("{\"audioKey\":\""+audioKey+"\"}")).andExpect(status().isCreated());
    }
    private void diagnostic(UUID id,String event,String extra) throws Exception {
        mvc.perform(post("/api/validation/diagnostics").header("Authorization",token(id)).contentType(APPLICATION_JSON)
                .content("{\"event\":\""+event+"\""+extra+"}")).andExpect(status().isNoContent());
    }
    private void publish(LearningActivity event) {
        new TransactionTemplate(transactions).executeWithoutResult(tx -> publisher.publishEvent(event));
    }
    private void enroll(UUID id) {
        jdbc.update("""
                INSERT INTO validation_participants (user_id,notice_version,acknowledged_at,starts_at,ends_at)
                VALUES (?,'pilot-v1',now()-interval '1 day',now()-interval '1 day',now()+interval '14 days')
                """,id);
    }
    private long activityCount() { return jdbc.queryForObject("SELECT count(*) FROM learning_activity WHERE card_id=?",Long.class,card); }
    private long friendCount() { return jdbc.queryForObject("SELECT count(*) FROM learning_activity WHERE kind='FRIEND_ACCEPTED' AND actor_id=?",Long.class,a); }
    private long total() { return jdbc.queryForObject("SELECT COALESCE(sum(total),0) FROM validation_diagnostic_daily",Long.class); }
    private String token(UUID id) { return "Bearer "+jwt.generateAccessToken(id,false); }
    private UUID user() {
        UUID id=UUID.randomUUID();
        jdbc.update("INSERT INTO users (id,email,username,native_language) VALUES (?,?,?,'ko')",id,id+"@test.example.com","u"+id.toString().substring(0,8));
        return id;
    }
}
