package me.yeonjae.tonebridge.application.port.in;

import java.util.UUID;

public interface RateCorrectionUseCase {
    record Command(UUID correctionId, UUID raterId, boolean helpful) {}
    void rate(Command command);
}
