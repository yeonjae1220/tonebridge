package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.session.StudySession;

import java.util.UUID;

public interface EndStudySessionUseCase {

    /** Compatibility endpoint. Sessions are no longer ended; only membership is checked. */
    StudySession end(UUID sessionId, UUID requesterId);
}
