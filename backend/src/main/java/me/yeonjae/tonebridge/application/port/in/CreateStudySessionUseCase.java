package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.session.StudySession;

import java.util.UUID;

public interface CreateStudySessionUseCase {
    record Command(UUID creatorId, UUID friendId, String title) {}

    StudySession create(Command command);
}
