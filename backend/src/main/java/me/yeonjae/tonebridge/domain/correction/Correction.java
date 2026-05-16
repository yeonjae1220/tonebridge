package me.yeonjae.tonebridge.domain.correction;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record Correction(
        UUID id,
        UUID requestId,
        UUID correctorId,
        boolean isAi,
        // Text fields
        String correctedText,
        String explanation,
        List<String> tags,
        // Audio fields
        List<TimestampComment> timestampComments,
        Integer pronunciationScore,
        Integer intonationScore,
        Integer fluencyScore,
        String referenceAudioUrl,
        // Common
        int creditEarned,
        CorrectionStatus status,
        Instant createdAt
) {}
