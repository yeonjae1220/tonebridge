package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.in.GetCorrectionResultUseCase;
import me.yeonjae.tonebridge.application.port.in.RateCorrectionUseCase;
import me.yeonjae.tonebridge.application.port.in.SubmitCorrectionUseCase;
import me.yeonjae.tonebridge.application.port.out.AiQualityCheckPort;
import me.yeonjae.tonebridge.application.port.out.CorrectionPort;
import me.yeonjae.tonebridge.application.port.out.CorrectionRequestPort;
import me.yeonjae.tonebridge.application.port.out.RatingPort;
import me.yeonjae.tonebridge.domain.correction.*;
import me.yeonjae.tonebridge.shared.config.ToneBridgeProperties;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional
@RequiredArgsConstructor
public class CorrectionService implements
        SubmitCorrectionUseCase,
        RateCorrectionUseCase,
        GetCorrectionResultUseCase {

    private final CorrectionRequestPort correctionRequestPort;
    private final CorrectionPort correctionPort;
    private final RatingPort ratingPort;
    private final AiQualityCheckPort aiQualityCheckPort;
    private final ToneBridgeProperties properties;

    @Override
    public Correction submit(SubmitCorrectionUseCase.Command command) {
        CorrectionRequest request = correctionRequestPort.findById(command.requestId())
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.REQUEST_NOT_FOUND));

        if (!request.isPending()) {
            throw new ToneBridgeException(ErrorCode.REQUEST_ALREADY_COMPLETED);
        }
        if (request.isOwnedBy(command.correctorId())) {
            throw new ToneBridgeException(ErrorCode.CANNOT_CORRECT_OWN_REQUEST);
        }

        int reward = properties.getCredit().getTextCorrectionReward();
        Correction correction = correctionPort.save(new Correction(
                null, command.requestId(), command.correctorId(), false,
                command.correctedText(), command.explanation(),
                command.tags() != null ? command.tags() : List.of(),
                List.of(), null, null, null, null,
                reward, CorrectionStatus.SUBMITTED, null
        ));

        correctionRequestPort.updateStatus(command.requestId(), RequestStatus.COMPLETED);

        aiQualityCheckPort.checkQualityAsync(
                correction.id(), command.correctorId(), request.requesterId(),
                request.contentText(), command.correctedText(), command.explanation()
        );

        return correction;
    }

    @Override
    public void rate(RateCorrectionUseCase.Command command) {
        if (ratingPort.existsByCorrection(command.correctionId())) {
            throw new ToneBridgeException(ErrorCode.ALREADY_RATED);
        }
        ratingPort.save(new Rating(null, command.correctionId(), command.raterId(), command.helpful(), null));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Correction> getResult(UUID requestId, UUID userId) {
        return correctionPort.findByRequestId(requestId);
    }
}
