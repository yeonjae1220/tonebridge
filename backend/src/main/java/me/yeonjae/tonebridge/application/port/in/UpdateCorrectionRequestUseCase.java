package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.correction.CorrectionRequest;

import java.util.List;
import java.util.UUID;

public interface UpdateCorrectionRequestUseCase {
    CorrectionRequest update(Command command);

    record Command(
            UUID requestId,
            UUID requesterId,
            String targetLanguage,
            String targetVariant,
            String contentText,
            String context,
            List<String> feedbackGoals
    ) {}
}
