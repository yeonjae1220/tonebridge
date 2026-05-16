package me.yeonjae.tonebridge.application.service;

import java.util.UUID;

public record QualityCheckCompletedEvent(
        UUID correctionId,
        UUID correctorId,
        UUID requesterId,
        boolean passed,
        int reward
) {}
