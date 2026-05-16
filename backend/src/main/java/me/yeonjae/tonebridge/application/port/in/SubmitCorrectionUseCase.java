package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.correction.Correction;

import java.util.List;
import java.util.UUID;

public interface SubmitCorrectionUseCase {
    record Command(UUID requestId, UUID correctorId, String correctedText, String explanation, List<String> tags) {}
    Correction submit(Command command);
}
