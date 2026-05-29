package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.in.AcceptCorrectionUseCase;
import me.yeonjae.tonebridge.application.port.in.GetCorrectionResultUseCase;
import me.yeonjae.tonebridge.application.port.in.LikeCorrectionUseCase;
import me.yeonjae.tonebridge.application.port.in.RateCorrectionUseCase;
import me.yeonjae.tonebridge.application.port.in.SubmitCorrectionUseCase;
import me.yeonjae.tonebridge.application.port.in.UpdateCorrectionUseCase;
import me.yeonjae.tonebridge.application.port.in.DeleteCorrectionUseCase;
import me.yeonjae.tonebridge.application.port.out.AiQualityCheckPort;
import me.yeonjae.tonebridge.application.port.out.CorrectionPort;
import me.yeonjae.tonebridge.application.port.out.CorrectionRequestPort;
import me.yeonjae.tonebridge.application.port.out.CreditPort;
import me.yeonjae.tonebridge.application.port.out.RatingPort;
import me.yeonjae.tonebridge.domain.correction.*;
import me.yeonjae.tonebridge.domain.credit.CreditTransaction;
import me.yeonjae.tonebridge.domain.credit.TransactionType;
import me.yeonjae.tonebridge.shared.config.ToneBridgeProperties;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
@RequiredArgsConstructor
public class CorrectionService implements
        SubmitCorrectionUseCase,
        RateCorrectionUseCase,
        GetCorrectionResultUseCase,
        UpdateCorrectionUseCase,
        DeleteCorrectionUseCase,
        AcceptCorrectionUseCase,
        LikeCorrectionUseCase {

    private final CorrectionRequestPort correctionRequestPort;
    private final CorrectionPort correctionPort;
    private final RatingPort ratingPort;
    private final AiQualityCheckPort aiQualityCheckPort;
    private final ToneBridgeProperties properties;
    private final ReputationService reputationService;
    private final CreditPort creditPort;

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

        boolean isAudio = request.type() == CorrectionType.AUDIO;
        int reward = isAudio
                ? (command.referenceAudioUrl() != null
                        ? properties.getCredit().getAudioWithRecordingReward()
                        : properties.getCredit().getAudioCorrectionReward())
                : properties.getCredit().getTextCorrectionReward();

        Correction correction = correctionPort.save(new Correction(
                null, command.requestId(), command.correctorId(), false,
                command.correctedText(), command.explanation(),
                command.tags() != null ? command.tags() : List.of(),
                command.timestampComments() != null ? command.timestampComments() : List.of(),
                command.pronunciationScore(), command.intonationScore(), command.fluencyScore(),
                command.referenceAudioUrl(),
                reward, CorrectionStatus.SUBMITTED, null
        ));

        String originalText = isAudio ? "(audio)" : request.contentText();
        String correctedText = isAudio ? command.explanation() : command.correctedText();
        aiQualityCheckPort.checkQualityAsync(
                correction.id(), command.correctorId(), request.requesterId(),
                originalText, correctedText, command.explanation(), reward, isAudio
        );

        return correction;
    }

    @Override
    public void rate(RateCorrectionUseCase.Command command) {
        Correction correction = correctionPort.findById(command.correctionId())
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.CORRECTION_NOT_FOUND));
        CorrectionRequest request = correctionRequestPort.findById(correction.requestId())
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.REQUEST_NOT_FOUND));

        if (!request.isOwnedBy(command.raterId())) {
            throw new ToneBridgeException(ErrorCode.UNAUTHORIZED);
        }
        if (ratingPort.existsByCorrection(command.correctionId())) {
            throw new ToneBridgeException(ErrorCode.ALREADY_RATED);
        }
        ratingPort.save(new Rating(null, command.correctionId(), command.raterId(), command.helpful(), null));

        if (correction.correctorId() != null) {
            reputationService.recalculate(correction.correctorId());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<CorrectionWithStats> getResult(UUID requestId, UUID userId) {
        CorrectionRequest request = correctionRequestPort.findById(requestId)
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.REQUEST_NOT_FOUND));
        List<Correction> corrections = correctionPort.findByRequestId(requestId);

        List<Correction> visible;
        if (request.isOwnedBy(userId)) {
            visible = corrections;
        } else {
            visible = corrections.stream()
                    .filter(c -> userId.equals(c.correctorId()))
                    .toList();
            if (visible.isEmpty()) {
                throw new ToneBridgeException(ErrorCode.UNAUTHORIZED);
            }
        }

        List<UUID> ids = visible.stream().map(Correction::id).toList();
        Map<UUID, Long> likeCounts = correctionPort.findLikeCountsByCorrectionIds(ids);
        Set<UUID> likedByUser = correctionPort.findLikedCorrectionIds(ids, userId);

        return visible.stream()
                .map(c -> new CorrectionWithStats(
                        c,
                        likeCounts.getOrDefault(c.id(), 0L).intValue(),
                        likedByUser.contains(c.id()),
                        c.id().equals(request.acceptedCorrectionId())
                ))
                .toList();
    }

    @Override
    public Correction update(UpdateCorrectionUseCase.Command command) {
        Correction correction = correctionPort.findById(command.correctionId())
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.CORRECTION_NOT_FOUND));
        if (!command.correctorId().equals(correction.correctorId())) {
            throw new ToneBridgeException(ErrorCode.UNAUTHORIZED);
        }
        return correctionPort.updateContent(
                command.correctionId(),
                command.correctedText(),
                command.explanation(),
                command.tags() != null ? command.tags() : List.of(),
                command.timestampComments() != null ? command.timestampComments() : List.of(),
                command.pronunciationScore(),
                command.intonationScore(),
                command.fluencyScore(),
                command.referenceAudioUrl()
        );
    }

    @Override
    public void accept(AcceptCorrectionUseCase.Command command) {
        Correction correction = correctionPort.findById(command.correctionId())
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.CORRECTION_NOT_FOUND));
        // 비관적 락으로 동시 채택 방지
        CorrectionRequest request = correctionRequestPort.findByIdForUpdate(correction.requestId())
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.REQUEST_NOT_FOUND));

        if (!request.isOwnedBy(command.requesterId())) {
            throw new ToneBridgeException(ErrorCode.UNAUTHORIZED);
        }
        if (request.acceptedCorrectionId() != null
                || request.status() == RequestStatus.EXPIRED
                || request.status() == RequestStatus.AI_COMPLETED) {
            throw new ToneBridgeException(ErrorCode.CORRECTION_ALREADY_ACCEPTED);
        }
        if (correction.status() == CorrectionStatus.REJECTED) {
            throw new ToneBridgeException(ErrorCode.CORRECTION_NOT_ACCEPTABLE);
        }

        correctionPort.updateStatus(command.correctionId(), CorrectionStatus.APPROVED);
        correctionRequestPort.updateAcceptedCorrection(correction.requestId(), command.correctionId());

        int bonus = properties.getCredit().getAcceptBonus();
        if (bonus > 0 && correction.correctorId() != null) {
            creditPort.adjustCredits(correction.correctorId(), bonus);
            creditPort.save(new CreditTransaction(
                    null, correction.correctorId(), bonus, TransactionType.BONUS,
                    command.correctionId(), "채택 보너스", null
            ));
        }
    }

    @Override
    public LikeCorrectionUseCase.Result toggleLike(LikeCorrectionUseCase.Command command) {
        correctionPort.findById(command.correctionId())
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.CORRECTION_NOT_FOUND));
        boolean liked = correctionPort.toggleLike(command.correctionId(), command.userId());
        Map<UUID, Long> counts = correctionPort.findLikeCountsByCorrectionIds(List.of(command.correctionId()));
        int likeCount = counts.getOrDefault(command.correctionId(), 0L).intValue();
        return new LikeCorrectionUseCase.Result(liked, likeCount);
    }

    @Override
    public void delete(UUID correctionId, UUID correctorId) {
        Correction correction = correctionPort.findById(correctionId)
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.CORRECTION_NOT_FOUND));
        if (!correctorId.equals(correction.correctorId())) {
            throw new ToneBridgeException(ErrorCode.UNAUTHORIZED);
        }
        if (correction.status() == CorrectionStatus.APPROVED) {
            throw new ToneBridgeException(ErrorCode.CORRECTION_DELETE_NOT_ALLOWED);
        }
        if (correctionPort.findByRequestId(correction.requestId()).size() <= 1) {
            throw new ToneBridgeException(ErrorCode.CORRECTION_DELETE_NOT_ALLOWED);
        }
        correctionPort.softDelete(correctionId);
    }
}
