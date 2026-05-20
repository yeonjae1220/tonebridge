package me.yeonjae.tonebridge.application.port.out;

import me.yeonjae.tonebridge.domain.studycard.LearnerAttempt;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LearnerAttemptPort {
    LearnerAttempt save(LearnerAttempt attempt);
    Optional<LearnerAttempt> findById(UUID id);
    Optional<LearnerAttempt> findLatestByCardId(UUID cardId);
    List<LearnerAttempt> findByCardId(UUID cardId);
    List<LearnerAttempt> findByLearnerId(UUID learnerId);
}
