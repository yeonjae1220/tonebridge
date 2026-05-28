package me.yeonjae.tonebridge.application.port.in;

import java.util.UUID;

public interface DeleteCorrectionRequestUseCase {
    void delete(UUID requestId, UUID requesterId);
}
