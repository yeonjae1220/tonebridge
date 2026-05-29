package me.yeonjae.tonebridge.application.port.in;

import java.util.UUID;

public interface AcceptCorrectionUseCase {
    record Command(UUID correctionId, UUID requesterId) {}

    void accept(Command command);
}
