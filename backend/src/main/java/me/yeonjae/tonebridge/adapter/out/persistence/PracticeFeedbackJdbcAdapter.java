package me.yeonjae.tonebridge.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.PracticeFeedbackPort;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class PracticeFeedbackJdbcAdapter implements PracticeFeedbackPort {
    private final NamedParameterJdbcTemplate jdbc;

    @Override
    public List<Item> findForLearner(UUID learnerId, int offset, int limit) {
        // All attempts, not latest-per-card; current membership and both active parents are mandatory.
        // A single bounded query avoids loading every notebook/card on the client.
        return jdbc.query("""
                SELECT a.id, a.card_id, c.session_id, c.phrase, s.title, LEFT(a.correction_note, 500) AS correction_note,
                       a.score, a.attempted_at, a.correction_author_id, u.username, a.correction_updated_at
                FROM learner_attempts a
                JOIN study_cards c ON c.id = a.card_id AND c.deleted_at IS NULL
                JOIN study_sessions s ON s.id = c.session_id AND s.deleted_at IS NULL
                LEFT JOIN users u ON u.id = a.correction_author_id
                WHERE a.learner_id = :userId AND a.correction_note IS NOT NULL
                  AND TRIM(a.correction_note) <> ''
                  AND EXISTS (SELECT 1 FROM session_members m
                              WHERE m.session_id = s.id AND m.user_id = :userId)
                ORDER BY COALESCE(a.correction_updated_at, a.attempted_at) DESC, a.id DESC
                LIMIT :limit OFFSET :offset
                """, Map.of("userId", learnerId, "offset", offset, "limit", limit),
                (rs, row) -> new Item(rs.getObject("id", UUID.class), rs.getObject("card_id", UUID.class),
                        rs.getObject("session_id", UUID.class), rs.getString("phrase"), rs.getString("title"),
                        rs.getString("correction_note"), rs.getObject("score", Integer.class),
                        instant(rs.getTimestamp("attempted_at")), rs.getObject("correction_author_id", UUID.class),
                        rs.getString("username"), instant(rs.getTimestamp("correction_updated_at"))));
    }

    private static Instant instant(Timestamp value) { return value == null ? null : value.toInstant(); }
}
