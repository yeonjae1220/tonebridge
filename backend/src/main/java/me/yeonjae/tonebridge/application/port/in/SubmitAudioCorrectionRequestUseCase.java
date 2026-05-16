package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.correction.CorrectionRequest;

import java.util.List;
import java.util.UUID;

public interface SubmitAudioCorrectionRequestUseCase {
    record Command(
            UUID requesterId,
            String targetLanguage,
            String audioKey,
            String context,
            List<String> feedbackGoals
    ) {}

    CorrectionRequest submit(Command command);
}
