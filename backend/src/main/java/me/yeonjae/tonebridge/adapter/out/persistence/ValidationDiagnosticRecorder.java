package me.yeonjae.tonebridge.adapter.out.persistence;

import me.yeonjae.tonebridge.shared.event.ValidationDiagnostic;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/** Durable aggregate storage; the authenticated UUID is used only to check eligibility. */
@Component
public class ValidationDiagnosticRecorder {
    public enum Result { RECORDED, IGNORED, RATE_LIMITED }
    private final JdbcTemplate jdbc;
    private final ValidationCollectionPolicy policy;
    private long windowStart = System.nanoTime();
    private int count;

    public ValidationDiagnosticRecorder(JdbcTemplate jdbc, ValidationCollectionPolicy policy) {
        this.jdbc = jdbc;
        this.policy = policy;
    }

    @Transactional
    public Result record(UUID userId, ValidationDiagnostic event) {
        if (!policy.allowsUser(userId)) return Result.IGNORED;
        if (!acquire()) return Result.RATE_LIMITED;
        jdbc.update("""
                INSERT INTO validation_diagnostic_daily (day, event, total)
                VALUES ((statement_timestamp() AT TIME ZONE 'UTC')::date, ?, 1)
                ON CONFLICT (day, event) DO UPDATE SET total = validation_diagnostic_daily.total + 1
                """, event.name());
        return Result.RECORDED;
    }

    // Per-process bound, including failed writes. No identifier map; client reports remain advisory.
    private synchronized boolean acquire() {
        long now = System.nanoTime();
        if (now - windowStart >= 60_000_000_000L) { windowStart = now; count = 0; }
        return ++count <= 600;
    }
}
