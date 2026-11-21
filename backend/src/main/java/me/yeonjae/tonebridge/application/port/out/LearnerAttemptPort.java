package me.yeonjae.tonebridge.application.port.out;

import me.yeonjae.tonebridge.domain.studycard.LearnerAttempt;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

public interface LearnerAttemptPort {
    LearnerAttempt save(LearnerAttempt attempt);
    Optional<LearnerAttempt> findById(UUID id);
    Optional<LearnerAttempt> findByRecording(UUID cardId, UUID learnerId, String audioKey);
    Optional<LearnerAttempt> findLatestByCardId(UUID cardId);

    /**
     * Batch-fetch the most recent attempt for each card in {@code cardIds}.
     * Returns a map of cardId → latest attempt (missing keys mean no attempt yet).
     * Prefer this over calling {@link #findLatestByCardId} in a loop to avoid N+1 queries.
     */
    Map<UUID, LearnerAttempt> findLatestByCardIds(Set<UUID> cardIds);

    List<LearnerAttempt> findByCardId(UUID cardId);
    List<LearnerAttempt> findByLearnerId(UUID learnerId);

    /**
     * Replaces the sounds feedback points at on one attempt, in the given order. Concurrent calls for
     * the same attempt are serialised. Ids must already be validated against the catalogue.
     */
    void replaceSoundTargets(UUID attemptId, List<String> guideIds, UUID authorId);
}
