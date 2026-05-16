package me.yeonjae.tonebridge.adapter.in.web.dto;

import me.yeonjae.tonebridge.domain.correction.Correction;

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
        int creditEarned,
        String status,
        Instant createdAt
) {
    public static CorrectionResponse from(Correction c) {
        return new CorrectionResponse(
                c.id(), c.requestId(), c.correctorId(), c.isAi(),
                c.correctedText(), c.explanation(), c.tags(),
                c.creditEarned(), c.status().name(), c.createdAt()
        );
    }
}
