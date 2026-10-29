package me.yeonjae.tonebridge.adapter.in.web;

import me.yeonjae.tonebridge.support.PostgresIntegrationTest;
import me.yeonjae.tonebridge.adapter.out.persistence.LearningActivityRecorder;
import me.yeonjae.tonebridge.shared.event.LearningActivity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.sql.Timestamp;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.http.MediaType.APPLICATION_JSON;

@TestPropertySource(properties = "tonebridge.validation.enabled=true")
class MvpValidationIntegrationTest extends PostgresIntegrationTest {
    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired ApplicationEventPublisher publisher;
    @Autowired PlatformTransactionManager transactions;
    @Autowired LearningActivityRecorder recorder;
    MockMvc mvc;
    UUID a,b,outsider,session,card;

    @BeforeEach void setUp() {
        mvc=MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        a=user(); b=user(); outsider=user(); session=UUID.randomUUID(); card=UUID.randomUUID();
        jdbc.update("INSERT INTO study_sessions (id, created_by) VALUES (?,?)",session,a);
        jdbc.update("INSERT INTO session_members (session_id,user_id) VALUES (?,?),(?,?)",session,a,session,b);
        jdbc.update("INSERT INTO study_cards (id,session_id,created_by_user_id,phrase) VALUES (?,?,?,'private phrase')",card,session,a);
    }

    @Test void acceptingFriendRequestRecordsOnlySuccessfulAcceptance() throws Exception {
        UUID request=UUID.randomUUID();
        jdbc.update("INSERT INTO friend_requests (id,sender_id,receiver_id,status) VALUES (?,?,?,'PENDING')",request,a,b);
        mvc.perform(post("/api/friends/{id}/accept",request).with(as(outsider))).andExpect(status().isForbidden());
        mvc.perform(post("/api/friends/{id}/accept",request).with(as(b))).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM learning_activity WHERE kind='FRIEND_ACCEPTED' AND actor_id=? AND peer_id=?",Long.class,b,a)).isEqualTo(1);
    }

    @Test void actualLearningProducesNoContentEventsAndUnauthorizedWritesDoNotCount() throws Exception {
        mvc.perform(post("/api/cards/{id}/native-audios",card).with(as(a)).contentType(APPLICATION_JSON)
                .content("{\"audioKey\":\"private/example.m4a\"}")).andExpect(status().isCreated());
        mvc.perform(post("/api/cards/{id}/attempts",card).with(as(b)).contentType(APPLICATION_JSON)
                .content("{\"audioKey\":\"private/practice.m4a\"}")).andExpect(status().isCreated());
        UUID attempt=jdbc.queryForObject("SELECT id FROM learner_attempts WHERE card_id=?",UUID.class,card);
        mvc.perform(patch("/api/attempts/{id}/correction",attempt).with(as(a)).contentType(APPLICATION_JSON)
                .content("{\"correctionNote\":\"private feedback\",\"score\":null}")).andExpect(status().isOk());
        mvc.perform(post("/api/cards/{id}/attempts",card).with(as(outsider)).contentType(APPLICATION_JSON)
                .content("{\"audioKey\":\"forbidden.m4a\"}")).andExpect(status().isForbidden());
        var events=jdbc.queryForList("SELECT * FROM learning_activity WHERE card_id=?",card);
        assertThat(events).hasSize(3);
        assertThat(events.toString()).doesNotContain("private", "forbidden", "audioKey", "correctionNote");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM credit_transactions WHERE user_id IN (?,?)",Long.class,a,b)).isZero();
    }

    @Test void rolledBackActionsDoNotCountAndExpiryCleanupAndAccountDeletionWork() {
        new TransactionTemplate(transactions).executeWithoutResult(tx -> {
            publisher.publishEvent(new LearningActivity(LearningActivity.Kind.PRACTICE_SAVED,a,null,session,card,UUID.randomUUID()));
            tx.setRollbackOnly();
        });
        assertThat(count()).isZero();
        event("PRACTICE_SAVED",a,null,UUID.randomUUID(),Instant.now().minus(32,ChronoUnit.DAYS));
        event("PRACTICE_SAVED",a,null,UUID.randomUUID(),Instant.now());
        recorder.purgeExpired();
        assertThat(count()).isEqualTo(1);
        // A separate user with no learning records isolates this new table's FK behavior.
        event("FRIEND_ACCEPTED",outsider,b,null,Instant.now());
        jdbc.update("DELETE FROM users WHERE id=?",outsider);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM learning_activity WHERE actor_id=?",Long.class,outsider)).isZero();
    }

    @Test void diagnosticsRequireAuthenticationAndOnlyAcceptFixedEventNames() throws Exception {
        mvc.perform(post("/api/validation/diagnostics").contentType(APPLICATION_JSON)
                .content("{\"event\":\"RECORDING_FAILED\"}")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/validation/diagnostics").with(as(a)).contentType(APPLICATION_JSON)
                .content("{\"event\":\"RECORDING_FAILED\"}")).andExpect(status().isNoContent());
        for (String payload: List.of("{}","{\"event\":\"email@example.com\"}")) {
            mvc.perform(post("/api/validation/diagnostics").with(as(a)).contentType(APPLICATION_JSON)
                    .content(payload)).andExpect(status().isBadRequest());
        }
        assertThat(count()).isZero();
    }

    @Test void simultaneousUnnamedFriendNotebooksConvergeAndNonFriendsAreRejected() throws Exception {
        jdbc.update("INSERT INTO friend_requests (id,sender_id,receiver_id,status) VALUES (?,?,?,'ACCEPTED')",UUID.randomUUID(),a,b);
        // Remove the setup notebook so both requests observe the first open.
        jdbc.update("DELETE FROM study_sessions WHERE id=?",session);
        ExecutorService pool=Executors.newFixedThreadPool(2);
        CountDownLatch start=new CountDownLatch(1);
        try {
            var first=pool.submit(() -> { start.await(); return open(a,b); });
            var second=pool.submit(() -> { start.await(); return open(b,a); });
            start.countDown();
            String one=first.get(15,TimeUnit.SECONDS); String two=second.get(15,TimeUnit.SECONDS);
            var json = tools.jackson.databind.json.JsonMapper.builder().build();
            assertThat(json.readTree(one).get("id").asText()).isEqualTo(json.readTree(two).get("id").asText());
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM study_sessions WHERE created_by IN (?,?)",Long.class,a,b)).isEqualTo(1);
        } finally { pool.shutdownNow(); }
        mvc.perform(post("/api/sessions").with(as(outsider)).contentType(APPLICATION_JSON)
                .content("{\"friendId\":\""+a+"\"}")).andExpect(status().isForbidden());
    }

    @Test void continuingWithFriendReusesTheSameNewestNotebookAsTheList() throws Exception {
        jdbc.update("INSERT INTO friend_requests (id,sender_id,receiver_id,status) VALUES (?,?,?,'ACCEPTED')",UUID.randomUUID(),a,b);
        jdbc.update("UPDATE study_sessions SET created_at=? WHERE id=?",Timestamp.from(Instant.now().minusSeconds(60)),session);
        UUID newest=UUID.randomUUID();
        jdbc.update("INSERT INTO study_sessions (id,created_by,title) VALUES (?,?,'new notebook')",newest,b);
        jdbc.update("INSERT INTO session_members (session_id,user_id) VALUES (?,?),(?,?)",newest,a,newest,b);
        mvc.perform(get("/api/sessions").with(as(a))).andExpect(jsonPath("$[0].id").value(newest.toString()));
        var json=tools.jackson.databind.json.JsonMapper.builder().build();
        assertThat(json.readTree(open(a,b)).get("id").asText()).isEqualTo(newest.toString());
        assertThat(json.readTree(open(b,a)).get("id").asText()).isEqualTo(newest.toString());
    }

    @Test void reportRequiresOrderedPeerLoopDeduplicatesEditsAndCountsBothUsersReturning() throws Exception {
        Instant start=Instant.now().minus(15,ChronoUnit.DAYS);
        event("FRIEND_ACCEPTED",a,b,null,start.plusSeconds(10));
        UUID attempt=UUID.randomUUID();
        event("EXAMPLE_SAVED",a,null,null,start.plusSeconds(20));
        event("PRACTICE_SAVED",b,null,attempt,start.plusSeconds(30));
        event("FEEDBACK_SAVED",b,b,attempt,start.plusSeconds(40)); // self note is not peer feedback
        assertThat(report(start).get("first_loop_pairs")).isEqualTo(0L);
        event("FEEDBACK_SAVED",a,b,attempt,start.plusSeconds(50));
        event("FEEDBACK_SAVED",a,b,attempt,start.plusSeconds(60)); // edit must not duplicate denominator
        event("PRACTICE_SAVED",b,null,UUID.randomUUID(),start.plusSeconds(70));
        event("PRACTICE_SAVED",a,null,UUID.randomUUID(),start.plus(8,ChronoUnit.DAYS));
        assertThat(report(start).get("week_two_pairs")).isEqualTo(0L);
        event("PRACTICE_SAVED",b,null,UUID.randomUUID(),start.plus(8,ChronoUnit.DAYS));
        Map<String,Object> result=report(start);
        for (String key:List.of("registered_pairs","connected_pairs","first_loop_pairs","feedback_learners","retried_learners","week_two_pairs"))
            assertThat(result.get(key)).as(key).isEqualTo(1L);
        assertThat(result.get("week_two_complete")).isEqualTo(true);
    }

    private String open(UUID actor,UUID friend) throws Exception {
        return mvc.perform(post("/api/sessions").with(as(actor)).contentType(APPLICATION_JSON)
                .content("{\"friendId\":\""+friend+"\"}")).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
    }
    private Map<String,Object> report(Instant start) throws Exception {
        String sql=Files.readString(Path.of("../scripts/validation/report.sql"))
                .replace(":'cohort'","?").replace(":'started_at'","?");
        return jdbc.queryForMap(sql,"[{\"a\":\""+a+"\",\"b\":\""+b+"\"},{\"a\":\""+b+"\",\"b\":\""+a+"\"}]",start.toString());
    }
    private void event(String kind,UUID actor,UUID peer,UUID attempt,Instant at) {
        jdbc.update("INSERT INTO learning_activity (id,kind,actor_id,peer_id,session_id,card_id,attempt_id,occurred_at) VALUES (?,?,?,?,?,?,?,?)",
            UUID.randomUUID(),kind,actor,peer,session,card,attempt,Timestamp.from(at));
    }
    private long count() { return jdbc.queryForObject("SELECT COUNT(*) FROM learning_activity WHERE card_id=?",Long.class,card); }
    private UUID user() {
        UUID id=UUID.randomUUID(); jdbc.update("INSERT INTO users (id,email,username,native_language) VALUES (?,?,?,'ko')",id,id+"@test.example.com","u"+id.toString().substring(0,8)); return id;
    }
    private static RequestPostProcessor as(UUID user) {
        return authentication(new UsernamePasswordAuthenticationToken(user,null,List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }
}
