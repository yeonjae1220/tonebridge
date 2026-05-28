package me.yeonjae.tonebridge.application.port.in;

import java.util.UUID;

public interface DeleteCorrectionUseCase {
    void delete(UUID correctionId, UUID correctorId);
}
