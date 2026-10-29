package me.yeonjae.tonebridge.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.shared.event.LearningActivity;
import org.springframework.beans.factory.annotation.Value;
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
    @Value("${tonebridge.validation.enabled:false}") private boolean enabled;

    // Join the learning transaction: rolled-back actions never become successful events.
    @EventListener
    @Transactional(propagation = Propagation.MANDATORY)
    public void record(LearningActivity event) {
        if (enabled) repository.save(new LearningActivityEntity(event));
    }

    // Continue cleanup even when collection is disabled. Live retention is at most 31 days.
    @Scheduled(fixedDelay = 86_400_000, initialDelay = 60_000)
    @Transactional
    public void purgeExpired() {
        repository.deleteByOccurredAtBefore(Instant.now().minus(30, ChronoUnit.DAYS));
    }
}
