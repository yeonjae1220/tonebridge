package me.yeonjae.tonebridge.adapter.in.web.dto;

import me.yeonjae.tonebridge.domain.studycard.StudyCard;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record StudyCardResponse(
        UUID id,
        UUID sessionId,
        UUID createdByUserId,
        String phrase,
        String context,
        String nativeAudioUrl,
        String explanation,
        List<String> tags,
        Instant createdAt,
        LearnerAttemptResponse latestAttempt
) {
    public static StudyCardResponse from(StudyCard c) {
        return new StudyCardResponse(
                c.id(), c.sessionId(), c.createdByUserId(),
                c.phrase(), c.context(), c.nativeAudioUrl(), c.explanation(),
                c.tags(), c.createdAt(),
                c.latestAttempt() != null ? LearnerAttemptResponse.from(c.latestAttempt()) : null);
    }
}
