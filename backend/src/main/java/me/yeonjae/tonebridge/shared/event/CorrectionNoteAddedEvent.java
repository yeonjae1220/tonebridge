package me.yeonjae.tonebridge.shared.event;

import java.util.UUID;

public record CorrectionNoteAddedEvent(UUID learnerId, UUID cardId, UUID sessionId, String reviewerUsername) {}
