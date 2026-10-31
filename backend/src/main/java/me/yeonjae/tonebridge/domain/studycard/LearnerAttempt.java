package me.yeonjae.tonebridge.domain.studycard;

import java.time.Instant;
import java.util.UUID;

public record LearnerAttempt(
        UUID id,
        UUID cardId,
        UUID learnerId,
        String audioUrl,
        String correctionNote,
        Integer score,
        Instant attemptedAt,
        UUID correctionAuthorId,
        Instant correctionUpdatedAt
) {
    // Retain source compatibility for existing clients/tests creating uncorrected attempts.
    public LearnerAttempt(UUID id, UUID cardId, UUID learnerId, String audioUrl,
                          String correctionNote, Integer score, Instant attemptedAt) {
        this(id, cardId, learnerId, audioUrl, correctionNote, score, attemptedAt, null, null);
    }

    public boolean isCorrected() {
        return correctionNote != null && !correctionNote.isBlank();
    }

    public LearnerAttempt withCorrection(String note, Integer newScore, UUID authorId, Instant updatedAt) {
        return new LearnerAttempt(id, cardId, learnerId, audioUrl, note, newScore, attemptedAt, authorId, updatedAt);
    }
}
