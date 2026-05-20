package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.session.StudySession;

import java.util.UUID;

public interface EndStudySessionUseCase {

    /** Marks the session as ENDED. Only a session member may end it. */
    StudySession end(UUID sessionId, UUID requesterId);
}
