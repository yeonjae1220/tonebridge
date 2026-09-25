package me.yeonjae.tonebridge.adapter.out.persistence;

import me.yeonjae.tonebridge.application.port.in.GetCorrectionFeedUseCase;
import me.yeonjae.tonebridge.application.port.in.GetCorrectionFeedUseCase.FeedCursor;
import me.yeonjae.tonebridge.domain.correction.CorrectionRequest;
import me.yeonjae.tonebridge.support.PostgresIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 피드 키셋 페이지네이션을 실제 PostgreSQL 에서 검증한다 — 정렬(방언 일치 우선 → 최신 → id)과
 * 커서 비교(마이크로초 timestamptz, uuid 순서)는 H2 로는 믿을 수 없다.
 */
class CorrectionFeedPaginationIntegrationTest extends PostgresIntegrationTest {

    private static final Instant BASE = Instant.parse("2026-09-01T10:00:00.123456Z");

    @Autowired GetCorrectionFeedUseCase feedUseCase;
    @Autowired JdbcTemplate jdbc;

    private UUID corrector;
    private UUID requester;

    /** (preferred, createdAt, id) — 기대 순서 계산용. uuid 는 PostgreSQL 처럼 바이트 순(= 소문자 hex 문자열 순)으로 비교한다. */
    private record Row(UUID id, boolean preferred, Instant createdAt) {}

    private static final Comparator<Row> FEED_ORDER = Comparator
            .comparing(Row::preferred).reversed()
            .thenComparing(Row::createdAt, Comparator.reverseOrder())
            .thenComparing(r -> r.id().toString(), Comparator.reverseOrder());

    @BeforeEach
    void setUp() {
        // 컨텍스트·DB 를 다른 통합 테스트와 공유하므로 이 테스트의 요청은 전용 언어(fi)로 격리한다.
        jdbc.update("DELETE FROM correction_requests WHERE target_language = 'fi'");
        corrector = insertUser("fi-FI", "");
        requester = insertUser("ko", "");
    }

    @Test
    void 모든_페이지를_이어_읽으면_중복_누락_없이_정렬_순서대로다() {
        List<Row> expected = seedRequests(27);

        List<UUID> collected = readAllPages(null, 7);

        assertThat(collected).containsExactlyElementsOf(expected.stream().map(Row::id).toList());
    }

    @Test
    void 예전_한도_limit_x3_보다_오래된_요청도_보인다() {
        // 예전 구현은 최신 limit×3 건만 읽어 메모리에서 재정렬했다 — limit 5 면 16번째부터는 영영 안 보였다.
        List<Row> expected = seedRequests(20);
        Row oldest = expected.stream().min(Comparator.comparing(Row::createdAt)).orElseThrow();

        assertThat(readAllPages(null, 5)).contains(oldest.id()).hasSize(20);
    }

    @Test
    void 페이지_도중_새_요청이_들어와도_이미_본_것과_겹치거나_빠지지_않는다() {
        List<Row> expected = seedRequests(12);

        GetCorrectionFeedUseCase.FeedPage first = feedUseCase.getFeedPage(corrector, null, 5);
        insertRequest("fi-FI", Instant.now());   // 가장 최신 + 방언 일치 → 정렬상 맨 앞
        List<UUID> collected = new ArrayList<>(first.items().stream().map(CorrectionRequest::id).toList());
        collected.addAll(readAllPages(FeedCursor.decode(first.nextCursor()), 5));

        assertThat(collected).containsExactlyElementsOf(expected.stream().map(Row::id).toList());
    }

    @Test
    void 교정할_수_없는_요청은_안_보인다() {
        insertRequest("fi-FI", BASE);                                          // 보임
        UUID own = insertRequestBy(corrector, "fi-FI", BASE);                   // 내 요청
        UUID completed = insertRequest("fi-FI", BASE);
        jdbc.update("UPDATE correction_requests SET status = 'COMPLETED' WHERE id = ?", completed);
        UUID deleted = insertRequest("fi-FI", BASE);
        jdbc.update("UPDATE correction_requests SET deleted_at = now() WHERE id = ?", deleted);

        List<UUID> visible = readAllPages(null, 10);

        assertThat(visible).hasSize(1).doesNotContain(own, completed, deleted);
    }

    /** 방언 일치(fi-FI)·불일치(fi-XX)·방언 없음을 섞고, 같은 시각 동점도 넣는다. */
    private List<Row> seedRequests(int count) {
        List<Row> rows = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            String variant = switch (i % 3) {
                case 0 -> "fi-FI";
                case 1 -> "fi-XX";
                default -> null;
            };
            // 4건 묶음마다 첫째·넷째가 같은 시각 — 둘 사이 순서는 id 로만 갈린다.
            Instant createdAt = BASE.minus((i / 4) * 90L, ChronoUnit.SECONDS).plus(i % 4 == 3 ? 0 : i % 4, ChronoUnit.MICROS);
            UUID id = insertRequest(variant, createdAt);
            rows.add(new Row(id, "fi-FI".equals(variant), createdAt));
        }
        return rows.stream().sorted(FEED_ORDER).toList();
    }

    private List<UUID> readAllPages(FeedCursor start, int limit) {
        List<UUID> ids = new ArrayList<>();
        FeedCursor cursor = start;
        for (int guard = 0; guard < 100; guard++) {
            GetCorrectionFeedUseCase.FeedPage page = feedUseCase.getFeedPage(corrector, cursor, limit);
            page.items().forEach(r -> ids.add(r.id()));
            if (page.nextCursor() == null) return ids;
            assertThat(page.items()).hasSize(limit);
            cursor = FeedCursor.decode(page.nextCursor());
        }
        throw new AssertionError("페이지가 끝나지 않는다 — 커서가 전진하지 않음");
    }

    private UUID insertUser(String nativeLanguage, String fluent) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO users (id, email, username, native_language, fluent_languages) VALUES (?, ?, ?, ?, ?)",
                id, id + "@test.example.com", "u" + id.toString().substring(0, 8), nativeLanguage, fluent);
        return id;
    }

    private UUID insertRequest(String variant, Instant createdAt) {
        return insertRequestBy(requester, variant, createdAt);
    }

    private UUID insertRequestBy(UUID requesterId, String variant, Instant createdAt) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO correction_requests
                    (id, requester_id, type, content_text, target_language, target_variant, credit_cost, created_at, updated_at, expires_at)
                VALUES (?, ?, 'TEXT', 'hello', 'fi', ?, 5, ?, ?, ?)
                """,
                id, requesterId, variant, Timestamp.from(createdAt), Timestamp.from(createdAt),
                Timestamp.from(createdAt.plus(2, ChronoUnit.DAYS)));
        return id;
    }
}
