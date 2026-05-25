package me.yeonjae.tonebridge.domain.studycard;

import java.time.Instant;
import java.util.UUID;

public record CardNativeAudio(
        UUID id,
        UUID cardId,
        String audioKey,
        Instant createdAt
) {}
