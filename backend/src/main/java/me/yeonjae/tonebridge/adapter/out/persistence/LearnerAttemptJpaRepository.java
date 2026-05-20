package me.yeonjae.tonebridge.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LearnerAttemptJpaRepository extends JpaRepository<LearnerAttemptEntity, UUID> {
    Optional<LearnerAttemptEntity> findFirstByCardIdOrderByAttemptedAtDesc(UUID cardId);
    List<LearnerAttemptEntity> findByCardIdOrderByAttemptedAtDesc(UUID cardId);
    List<LearnerAttemptEntity> findByLearnerIdOrderByAttemptedAtDesc(UUID learnerId);

    /**
     * Fetches the latest attempt per card for all cards in {@code cardIds} using a
     * single query (no N+1).  Uses a subquery to pick the most recent row per card.
     */
    @Query("""
            SELECT a FROM LearnerAttemptEntity a
            WHERE a.cardId IN :cardIds
              AND a.attemptedAt = (
                  SELECT MAX(a2.attemptedAt) FROM LearnerAttemptEntity a2
                  WHERE a2.cardId = a.cardId
              )
            """)
    List<LearnerAttemptEntity> findLatestByCardIdIn(Collection<UUID> cardIds);
}
