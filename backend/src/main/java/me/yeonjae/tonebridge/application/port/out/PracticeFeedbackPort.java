package me.yeonjae.tonebridge.application.port.out;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface PracticeFeedbackPort {
    record Item(UUID attemptId, UUID cardId, UUID sessionId, String phrase, String sessionTitle,
                String correctionNote, Integer score, Instant attemptedAt,
                UUID correctionAuthorId, String correctionAuthorName, Instant correctionUpdatedAt) {}
    List<Item> findForLearner(UUID learnerId, int offset, int limit);
}
