package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.correction.CorrectionRequest;

import java.util.List;
import java.util.UUID;

public interface SubmitTextCorrectionRequestUseCase {
    record Command(
            UUID requesterId,
            String targetLanguage,
            String contentText,
            String context,
            List<String> feedbackGoals
    ) {}

    CorrectionRequest submit(Command command);
}
