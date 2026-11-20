package me.yeonjae.tonebridge.domain.studycard;

import java.time.Instant;
import java.util.List;
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
        Instant correctionUpdatedAt,
        /** Guide ids from {@link SoundGuideCatalog} the feedback points at, in display order. Never null. */
        List<String> soundGuideIds
) {
    public LearnerAttempt {
        soundGuideIds = soundGuideIds == null ? List.of() : List.copyOf(soundGuideIds);
    }

    public LearnerAttempt(UUID id, UUID cardId, UUID learnerId, String audioUrl, String correctionNote,
                          Integer score, Instant attemptedAt, UUID correctionAuthorId, Instant correctionUpdatedAt) {
        this(id, cardId, learnerId, audioUrl, correctionNote, score, attemptedAt, correctionAuthorId, correctionUpdatedAt, List.of());
    }

    // Retain source compatibility for existing clients/tests creating uncorrected attempts.
    public LearnerAttempt(UUID id, UUID cardId, UUID learnerId, String audioUrl,
                          String correctionNote, Integer score, Instant attemptedAt) {
        this(id, cardId, learnerId, audioUrl, correctionNote, score, attemptedAt, null, null, List.of());
    }

    public boolean isCorrected() {
        return correctionNote != null && !correctionNote.isBlank();
    }

    public LearnerAttempt withCorrection(String note, Integer newScore, UUID authorId, Instant updatedAt) {
        return new LearnerAttempt(id, cardId, learnerId, audioUrl, note, newScore, attemptedAt, authorId, updatedAt, soundGuideIds);
    }

    public LearnerAttempt withSoundGuideIds(List<String> guideIds) {
        return new LearnerAttempt(id, cardId, learnerId, audioUrl, correctionNote, score, attemptedAt,
                correctionAuthorId, correctionUpdatedAt, guideIds);
    }
}
