package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.correction.CorrectionWithStats;

import java.util.List;
import java.util.UUID;

public interface GetCorrectionResultUseCase {
    List<CorrectionWithStats> getResult(UUID requestId, UUID userId);
}
