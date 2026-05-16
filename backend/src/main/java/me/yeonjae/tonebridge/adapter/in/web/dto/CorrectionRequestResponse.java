package me.yeonjae.tonebridge.adapter.in.web.dto;

import me.yeonjae.tonebridge.domain.correction.CorrectionRequest;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record CorrectionRequestResponse(
        UUID id,
        UUID requesterId,
        String type,
        String contentText,
        String audioUrl,
        String targetLanguage,
        String context,
        List<String> feedbackGoals,
        int creditCost,
        String status,
        Instant createdAt,
        Instant expiresAt
) {
    public static CorrectionRequestResponse from(CorrectionRequest r) {
        return new CorrectionRequestResponse(
                r.id(), r.requesterId(), r.type().name(), r.contentText(), r.audioUrl(),
                r.targetLanguage(), r.context(), r.feedbackGoals(),
                r.creditCost(), r.status().name(), r.createdAt(), r.expiresAt()
        );
    }
}
