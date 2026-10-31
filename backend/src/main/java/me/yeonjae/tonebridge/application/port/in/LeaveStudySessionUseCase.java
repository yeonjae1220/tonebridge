package me.yeonjae.tonebridge.application.port.in;

import java.util.UUID;

public interface LeaveStudySessionUseCase {
    void leave(UUID sessionId, UUID requesterId);
}
