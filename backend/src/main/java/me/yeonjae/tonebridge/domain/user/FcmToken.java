package me.yeonjae.tonebridge.domain.user;

import java.time.Instant;
import java.util.UUID;

public record FcmToken(
        UUID id,
        UUID userId,
        String token,
        Platform platform,
        Instant createdAt,
        Instant updatedAt
) {}
