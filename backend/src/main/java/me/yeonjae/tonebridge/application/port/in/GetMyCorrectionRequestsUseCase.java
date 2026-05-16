package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.correction.CorrectionRequest;

import java.util.List;
import java.util.UUID;

public interface GetMyCorrectionRequestsUseCase {
    List<CorrectionRequest> getMine(UUID userId);
}
