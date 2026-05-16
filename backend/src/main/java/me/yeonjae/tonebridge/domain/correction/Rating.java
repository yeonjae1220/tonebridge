package me.yeonjae.tonebridge.domain.correction;

import java.time.Instant;
import java.util.UUID;

public record Rating(
        UUID id,
        UUID correctionId,
        UUID raterId,
        boolean helpful,
        Instant createdAt
) {}
