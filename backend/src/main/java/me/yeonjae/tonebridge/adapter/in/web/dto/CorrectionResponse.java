package me.yeonjae.tonebridge.adapter.in.web.dto;

import me.yeonjae.tonebridge.domain.correction.Correction;
import me.yeonjae.tonebridge.domain.correction.CorrectionWithStats;
import me.yeonjae.tonebridge.domain.correction.TimestampComment;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record CorrectionResponse(
        UUID id,
        UUID requestId,
        UUID correctorId,
        boolean isAi,
        String correctedText,
        String explanation,
        List<String> tags,
        List<TimestampComment> timestampComments,
        Integer pronunciationScore,
        Integer intonationScore,
        Integer fluencyScore,
        String referenceAudioUrl,
        int creditEarned,
        String status,
        Instant createdAt,
        int likeCount,
        boolean likedByMe,
        boolean isAccepted
) {
    public static CorrectionResponse from(CorrectionWithStats s) {
        Correction c = s.correction();
        return new CorrectionResponse(
                c.id(), c.requestId(), c.correctorId(), c.isAi(),
                c.correctedText(), c.explanation(), c.tags(),
                c.timestampComments(), c.pronunciationScore(), c.intonationScore(),
                c.fluencyScore(), c.referenceAudioUrl(),
                c.creditEarned(), c.status().name(), c.createdAt(),
                s.likeCount(), s.likedByMe(), s.isAccepted()
        );
    }
}
