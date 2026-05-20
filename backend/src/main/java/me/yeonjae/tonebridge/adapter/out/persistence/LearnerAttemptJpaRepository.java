package me.yeonjae.tonebridge.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LearnerAttemptJpaRepository extends JpaRepository<LearnerAttemptEntity, UUID> {
    Optional<LearnerAttemptEntity> findFirstByCardIdOrderByAttemptedAtDesc(UUID cardId);
    List<LearnerAttemptEntity> findByCardIdOrderByAttemptedAtDesc(UUID cardId);
    List<LearnerAttemptEntity> findByLearnerIdOrderByAttemptedAtDesc(UUID learnerId);
}
