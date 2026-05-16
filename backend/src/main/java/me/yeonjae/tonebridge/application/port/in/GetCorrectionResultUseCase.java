package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.correction.Correction;

import java.util.List;
import java.util.UUID;

public interface GetCorrectionResultUseCase {
    List<Correction> getResult(UUID requestId, UUID userId);
}
