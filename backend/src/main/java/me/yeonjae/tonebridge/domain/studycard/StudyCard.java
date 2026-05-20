package me.yeonjae.tonebridge.domain.studycard;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record StudyCard(
        UUID id,
        UUID sessionId,
        UUID createdByUserId,
        String phrase,
        String context,
        String nativeAudioUrl,
        String explanation,
        List<String> tags,
        Instant createdAt,
        LearnerAttempt latestAttempt
) {
    public boolean hasNativeAudio() {
        return nativeAudioUrl != null && !nativeAudioUrl.isBlank();
    }

    public StudyCard withNativeAudio(String audioUrl) {
        return new StudyCard(id, sessionId, createdByUserId, phrase, context,
                audioUrl, explanation, tags, createdAt, latestAttempt);
    }

    public StudyCard withLatestAttempt(LearnerAttempt attempt) {
        return new StudyCard(id, sessionId, createdByUserId, phrase, context,
                nativeAudioUrl, explanation, tags, createdAt, attempt);
    }
}
