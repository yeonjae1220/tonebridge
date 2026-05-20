package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.session.StudySession;

import java.util.List;
import java.util.UUID;

public interface GetStudySessionsUseCase {
    List<StudySession> getSessions(UUID userId);
    StudySession getSession(UUID sessionId, UUID requesterId);
}
