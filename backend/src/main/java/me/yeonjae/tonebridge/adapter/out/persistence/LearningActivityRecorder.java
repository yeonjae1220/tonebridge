package me.yeonjae.tonebridge.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.shared.event.LearningActivity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Component
@RequiredArgsConstructor
public class LearningActivityRecorder {
    private final LearningActivityRepository repository;
    private final ValidationCollectionPolicy policy;
    private final JdbcTemplate jdbc;

    // Join the learning transaction: rolled-back actions never become successful events.
    @EventListener
    @Transactional(propagation = Propagation.MANDATORY)
    public void record(LearningActivity event) {
        if (policy.allowsActivity(event)) repository.save(new LearningActivityEntity(event));
    }

    // Continue cleanup even when collection is disabled. Live retention is at most 31 days.
    @Scheduled(fixedDelay = 86_400_000, initialDelay = 60_000)
    @Transactional
    public void purgeExpired() {
        repository.deleteByOccurredAtBefore(Instant.now().minus(30, ChronoUnit.DAYS));
        // Local H2 creates only JPA tables and never supports pilot collection.
        if (!policy.supportsDurableStorage()) return;
        // Whole UTC day buckets: retain today plus 29 preceding days at each daily cleanup.
        jdbc.update("DELETE FROM validation_diagnostic_daily WHERE day < (statement_timestamp() AT TIME ZONE 'UTC')::date - 29");
        jdbc.update("""
                DELETE FROM validation_participants
                WHERE LEAST(ends_at, COALESCE(revoked_at, ends_at)) < statement_timestamp() - interval '30 days'
                """);
    }
}
