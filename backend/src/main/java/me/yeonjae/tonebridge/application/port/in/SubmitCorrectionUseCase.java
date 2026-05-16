package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.correction.Correction;
import me.yeonjae.tonebridge.domain.correction.TimestampComment;

import java.util.List;
import java.util.UUID;

public interface SubmitCorrectionUseCase {
    record Command(
            UUID requestId,
            UUID correctorId,
            // 텍스트 필드
            String correctedText,
            String explanation,
            List<String> tags,
            // 음성 필드 (AUDIO 타입에만 사용, nullable)
            List<TimestampComment> timestampComments,
            Integer pronunciationScore,
            Integer intonationScore,
            Integer fluencyScore,
            String referenceAudioUrl
    ) {}

    Correction submit(Command command);
}
