package me.yeonjae.tonebridge.adapter.out.persistence;

import me.yeonjae.tonebridge.application.port.out.RatingPort;
import me.yeonjae.tonebridge.support.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

class RatingRecoveryIntegrationTest extends PostgresIntegrationTest {
    @Autowired RatingPort ratings;
    @Autowired JdbcTemplate jdbc;

    @Test
    void recoveryReadsOnlyRequestedCorrectionsRatedByTheCurrentAccount() {
        UUID owner = user(), other = user();
        UUID yes = correction(owner), no = correction(owner), outside = correction(owner), others = correction(other);
        for (UUID id : List.of(yes, no, outside, others)) {
            jdbc.update("INSERT INTO ratings (id, correction_id, rater_id, helpful) VALUES (?, ?, ?, ?)",
                    UUID.randomUUID(), id, id.equals(others) ? other : owner, id.equals(yes));
        }
        // Both helpful and unhelpful ratings mean completed; another account's rating is not mine.
        assertThat(ratings.findRatedCorrectionIds(List.of(yes, no, others), owner)).containsExactlyInAnyOrder(yes, no);
        assertThat(ratings.findRatedCorrectionIds(List.of(yes, no, others), other)).containsExactly(others);
        assertThat(ratings.findRatedCorrectionIds(List.of(), owner)).isEmpty();
    }

    private UUID user() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO users (id, email, username, native_language) VALUES (?, ?, ?, 'ko')",
                id, id + "@test.example.com", "u" + id.toString().substring(0, 8));
        return id;
    }
    private UUID correction(UUID requester) {
        UUID requestId = UUID.randomUUID(), id = UUID.randomUUID();
        jdbc.update("INSERT INTO correction_requests (id, requester_id, type, content_text, target_language, credit_cost) VALUES (?, ?, 'TEXT', 'hello', 'en', 5)", requestId, requester);
        jdbc.update("INSERT INTO corrections (id, request_id) VALUES (?, ?)", id, requestId);
        return id;
    }
}
