package me.yeonjae.tonebridge.domain.correction;

public record TimestampComment(
        double start,
        double end,
        String comment,
        String category  // pronunciation, intonation, fluency, naturalness
) {}
