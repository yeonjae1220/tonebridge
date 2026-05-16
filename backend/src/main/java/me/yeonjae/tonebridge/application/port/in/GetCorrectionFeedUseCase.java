package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.correction.CorrectionRequest;

import java.util.List;
import java.util.UUID;

public interface GetCorrectionFeedUseCase {
    List<CorrectionRequest> getFeed(UUID correctorId, int limit);
}
