package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.session.StudySession;

import java.util.UUID;

public interface UpdateStudySessionUseCase {
    StudySession update(UUID sessionId, UUID requesterId, String title);
}
