package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.correction.Correction;
import me.yeonjae.tonebridge.domain.correction.TimestampComment;

import java.util.List;
import java.util.UUID;

public interface UpdateCorrectionUseCase {
    Correction update(Command command);

    record Command(
            UUID correctionId,
            UUID correctorId,
            String correctedText,
            String explanation,
            List<String> tags,
            List<TimestampComment> timestampComments,
            Integer pronunciationScore,
            Integer intonationScore,
            Integer fluencyScore,
            String referenceAudioUrl
    ) {}
}
