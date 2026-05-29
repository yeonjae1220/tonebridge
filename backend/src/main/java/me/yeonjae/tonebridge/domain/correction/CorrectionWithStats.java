package me.yeonjae.tonebridge.domain.correction;

public record CorrectionWithStats(
        Correction correction,
        int likeCount,
        boolean likedByMe,
        boolean isAccepted
) {}
