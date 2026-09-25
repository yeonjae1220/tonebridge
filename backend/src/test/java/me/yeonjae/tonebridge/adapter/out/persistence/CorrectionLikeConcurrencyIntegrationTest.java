package me.yeonjae.tonebridge.adapter.out.persistence;

import me.yeonjae.tonebridge.application.port.in.LikeCorrectionUseCase;
import me.yeonjae.tonebridge.support.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 좋아요 멱등성을 실제 PostgreSQL 에서 검증한다. ON CONFLICT·유니크 위반 시 트랜잭션 abort 는
 * H2 테스트 DB 로는 재현되지 않는다(GLOBAL-PIT-184).
 */
class CorrectionLikeConcurrencyIntegrationTest extends PostgresIntegrationTest {

    @Autowired LikeCorrectionUseCase likeUseCase;
    @Autowired JdbcTemplate jdbc;

    // 수정 전(토글 + save 후 DataIntegrityViolation catch)에는 20쌍 중 20쌍에서 한쪽이
    // duplicate key(uq_correction_like)로 실패했다 — catch 가 flush 시점의 예외에 닿지 못해서다.
    @Test
    void 같은_사용자의_동시_좋아요는_둘_다_성공하고_행은_하나() throws Exception {
        UUID liker = insertUser();
        for (int i = 0; i < 20; i++) {
            UUID correctionId = insertCorrection();
            LikeCorrectionUseCase.Command command = new LikeCorrectionUseCase.Command(correctionId, liker);

            List<Throwable> failures = runConcurrently(2, () -> likeUseCase.like(command));

            assertThat(failures).isEmpty();
            assertThat(likeRows(correctionId)).isEqualTo(1);
        }
    }

    @Test
    void 같은_사용자의_동시_취소는_둘_다_성공하고_행은_없다() throws Exception {
        UUID liker = insertUser();
        for (int i = 0; i < 20; i++) {
            UUID correctionId = insertCorrection();
            LikeCorrectionUseCase.Command command = new LikeCorrectionUseCase.Command(correctionId, liker);
            likeUseCase.like(command);

            List<Throwable> failures = runConcurrently(2, () -> likeUseCase.unlike(command));

            assertThat(failures).isEmpty();
            assertThat(likeRows(correctionId)).isZero();
        }
    }

    @Test
    void 재시도해도_상태가_뒤집히지_않는다() {
        UUID liker = insertUser();
        UUID correctionId = insertCorrection();
        LikeCorrectionUseCase.Command command = new LikeCorrectionUseCase.Command(correctionId, liker);

        assertThat(likeUseCase.like(command)).isEqualTo(new LikeCorrectionUseCase.Result(true, 1));
        assertThat(likeUseCase.like(command)).isEqualTo(new LikeCorrectionUseCase.Result(true, 1));
        assertThat(likeUseCase.unlike(command)).isEqualTo(new LikeCorrectionUseCase.Result(false, 0));
        assertThat(likeUseCase.unlike(command)).isEqualTo(new LikeCorrectionUseCase.Result(false, 0));
    }

    @Test
    void 좋아요_수는_사용자별로_센다() {
        UUID correctionId = insertCorrection();

        likeUseCase.like(new LikeCorrectionUseCase.Command(correctionId, insertUser()));
        LikeCorrectionUseCase.Result second = likeUseCase.like(new LikeCorrectionUseCase.Command(correctionId, insertUser()));

        assertThat(second.likeCount()).isEqualTo(2);
    }

    private int likeRows(UUID correctionId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM correction_likes WHERE correction_id = ?", Integer.class, correctionId);
    }

    private List<Throwable> runConcurrently(int n, Callable<?> task) throws InterruptedException {
        ExecutorService pool = Executors.newFixedThreadPool(n);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < n; i++) futures.add(pool.submit(() -> { start.await(); return task.call(); }));
        start.countDown();
        List<Throwable> failures = new ArrayList<>();
        for (Future<?> f : futures) {
            try { f.get(30, TimeUnit.SECONDS); } catch (ExecutionException e) { failures.add(e.getCause()); } catch (TimeoutException e) { failures.add(e); }
        }
        pool.shutdownNow();
        return failures;
    }

    private UUID insertUser() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO users (id, email, username, native_language) VALUES (?, ?, ?, 'ko')",
                id, id + "@test.example.com", "u" + id.toString().substring(0, 8));
        return id;
    }

    private UUID insertCorrection() {
        UUID requester = insertUser();
        UUID requestId = UUID.randomUUID();
        jdbc.update("INSERT INTO correction_requests (id, requester_id, type, content_text, target_language, credit_cost) VALUES (?, ?, 'TEXT', 'hello', 'en', 5)",
                requestId, requester);
        UUID correctionId = UUID.randomUUID();
        jdbc.update("INSERT INTO corrections (id, request_id) VALUES (?, ?)", correctionId, requestId);
        return correctionId;
    }
}
