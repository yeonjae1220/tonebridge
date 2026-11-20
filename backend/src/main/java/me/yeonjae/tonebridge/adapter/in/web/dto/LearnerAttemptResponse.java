package me.yeonjae.tonebridge.adapter.in.web.dto;

import me.yeonjae.tonebridge.domain.studycard.LearnerAttempt;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record LearnerAttemptResponse(
        UUID id,
        UUID cardId,
        UUID learnerId,
        String audioUrl,
        String correctionNote,
        Integer score,
        Instant attemptedAt,
        UUID correctionAuthorId,
        Instant correctionUpdatedAt,
        List<SoundTarget> soundTargets
) {
    public record SoundTarget(String guideId) {}

    public static LearnerAttemptResponse from(LearnerAttempt a) {
        return new LearnerAttemptResponse(a.id(), a.cardId(), a.learnerId(),
                a.audioUrl(), a.correctionNote(), a.score(), a.attemptedAt(), a.correctionAuthorId(), a.correctionUpdatedAt(),
                a.soundGuideIds().stream().map(SoundTarget::new).toList());
    }
}
