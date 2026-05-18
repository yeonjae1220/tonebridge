package me.yeonjae.tonebridge.domain.correction;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record CorrectionRequest(
        UUID id,
        UUID requesterId,
        CorrectionType type,
        String contentText,
        String audioUrl,
        String targetLanguage,
        String targetVariant,
        String context,
        List<String> feedbackGoals,
        int creditCost,
        RequestStatus status,
        String aiCorrection,
        Instant createdAt,
        Instant expiresAt
) {
    public boolean isPending() {
        return status == RequestStatus.PENDING;
    }

    public boolean isOwnedBy(UUID userId) {
        return requesterId.equals(userId);
    }
}
