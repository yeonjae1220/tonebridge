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
        Instant attemptedAt
) {
    public boolean isCorrected() {
        return correctionNote != null && !correctionNote.isBlank();
    }

    public LearnerAttempt withCorrection(String note, Integer newScore) {
        return new LearnerAttempt(id, cardId, learnerId, audioUrl, note, newScore, attemptedAt);
    }
}
