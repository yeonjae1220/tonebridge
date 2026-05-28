package me.yeonjae.tonebridge.application.port.in;

import java.util.UUID;

public interface DeleteStudySessionUseCase {
    void delete(UUID sessionId, UUID requesterId);
}
