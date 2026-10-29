package me.yeonjae.tonebridge.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import java.time.Instant;
import java.util.UUID;

public interface LearningActivityRepository extends JpaRepository<LearningActivityEntity, UUID> {
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("DELETE FROM LearningActivityEntity e WHERE e.occurredAt < :cutoff")
    int deleteByOccurredAtBefore(Instant cutoff);
}
