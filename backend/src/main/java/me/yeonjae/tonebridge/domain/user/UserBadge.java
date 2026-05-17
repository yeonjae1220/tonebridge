package me.yeonjae.tonebridge.domain.user;

import java.time.Instant;
import java.util.UUID;

public record UserBadge(
        UUID id,
        UUID userId,
        BadgeType badgeType,
        Instant awardedAt
) {}
