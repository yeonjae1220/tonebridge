package me.yeonjae.tonebridge.domain.admin;

import java.time.Instant;
import java.util.UUID;

public record AdminUserSummary(
        UUID id,
        String email,
        String username,
        String nativeLanguage,
        int credits,
        double reputationScore,
        int correctionStreak,
        boolean isAdmin,
        Instant createdAt
) {}
