package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.in.GetCorrectionFeedUseCase;
import me.yeonjae.tonebridge.application.port.in.GetMyCorrectionRequestsUseCase;
import me.yeonjae.tonebridge.application.port.in.SubmitAudioCorrectionRequestUseCase;
import me.yeonjae.tonebridge.application.port.in.SubmitTextCorrectionRequestUseCase;
import me.yeonjae.tonebridge.application.port.in.UpdateCorrectionRequestUseCase;
import me.yeonjae.tonebridge.application.port.in.DeleteCorrectionRequestUseCase;
import me.yeonjae.tonebridge.application.port.out.CorrectionPort;
import me.yeonjae.tonebridge.application.port.out.CorrectionRequestPort;
import me.yeonjae.tonebridge.application.port.out.CreditPort;
import me.yeonjae.tonebridge.application.port.out.LanguageVariantPort;
import me.yeonjae.tonebridge.application.port.out.UserPort;
import me.yeonjae.tonebridge.domain.correction.CorrectionRequest;
import me.yeonjae.tonebridge.domain.correction.CorrectionType;
import me.yeonjae.tonebridge.domain.correction.RequestStatus;
import me.yeonjae.tonebridge.domain.credit.CreditTransaction;
import me.yeonjae.tonebridge.domain.credit.TransactionType;
import me.yeonjae.tonebridge.domain.user.User;
import me.yeonjae.tonebridge.shared.config.ToneBridgeProperties;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import me.yeonjae.tonebridge.shared.util.LanguageCodeUtils;

import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@Transactional
@RequiredArgsConstructor
public class CorrectionRequestService implements
        SubmitTextCorrectionRequestUseCase,
        SubmitAudioCorrectionRequestUseCase,
        GetCorrectionFeedUseCase,
        GetMyCorrectionRequestsUseCase,
        UpdateCorrectionRequestUseCase,
        DeleteCorrectionRequestUseCase {

    private final CorrectionRequestPort correctionRequestPort;
    private final CorrectionPort correctionPort;
    private final CreditPort creditPort;
    private final UserPort userPort;
    private final LanguageVariantPort languageVariantPort;
    private final ToneBridgeProperties properties;

    private void validateVariant(String targetLanguage, String targetVariant) {
        if (targetVariant == null) return;
        LanguageVariantPort.LanguageVariantDto variant = languageVariantPort.findActiveByCode(targetVariant)
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.INVALID_INPUT));
        String expectedBase = LanguageCodeUtils.baseCode(targetLanguage);
        if (!expectedBase.equals(variant.parentCode())) {
            throw new ToneBridgeException(ErrorCode.INVALID_INPUT);
        }
    }

    @Override
    public CorrectionRequest submit(SubmitTextCorrectionRequestUseCase.Command command) {
        validateVariant(command.targetLanguage(), command.targetVariant());
        int cost = properties.getCredit().getTextRequestCost();
        creditPort.adjustCredits(command.requesterId(), -cost);
        creditPort.save(new CreditTransaction(null, command.requesterId(), -cost,
                TransactionType.SPEND, null, "텍스트 교정 요청", null));

        CorrectionRequest request = new CorrectionRequest(
                null, command.requesterId(), CorrectionType.TEXT,
                command.contentText(), null, command.targetLanguage(), command.targetVariant(),
                command.context(),
                command.feedbackGoals() != null ? command.feedbackGoals() : List.of(),
                cost, RequestStatus.PENDING, null, null, null
        );
        return correctionRequestPort.save(request);
    }

    @Override
    public CorrectionRequest submit(SubmitAudioCorrectionRequestUseCase.Command command) {
        validateVariant(command.targetLanguage(), command.targetVariant());
        int cost = properties.getCredit().getAudioRequestCost();
        creditPort.adjustCredits(command.requesterId(), -cost);
        creditPort.save(new CreditTransaction(null, command.requesterId(), -cost,
                TransactionType.SPEND, null, "음성 교정 요청", null));

        CorrectionRequest request = new CorrectionRequest(
                null, command.requesterId(), CorrectionType.AUDIO,
                null, command.audioKey(), command.targetLanguage(), command.targetVariant(),
                command.context(),
                command.feedbackGoals() != null ? command.feedbackGoals() : List.of(),
                cost, RequestStatus.PENDING, null, null, null
        );
        return correctionRequestPort.save(request);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CorrectionRequest> getFeed(UUID correctorId, int limit) {
        User corrector = userPort.findById(correctorId)
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.USER_NOT_FOUND));

        List<String> correctorVariants = Stream.concat(
                corrector.fluentLanguages().stream(),
                Stream.of(corrector.nativeLanguage())
        ).filter(s -> s != null && !s.isBlank()).toList();

        List<String> baseLanguages = correctorVariants.stream()
                .map(LanguageCodeUtils::baseCode)
                .distinct()
                .toList();

        Set<String> variantSet = correctorVariants.stream()
                .collect(Collectors.toUnmodifiableSet());

        List<CorrectionRequest> feed = correctionRequestPort.findFeed(correctorId, baseLanguages, limit * 3);

        return feed.stream()
                .sorted(Comparator.comparingInt((CorrectionRequest r) ->
                        r.targetVariant() != null && variantSet.contains(r.targetVariant()) ? 0 : 1)
                        .thenComparing(CorrectionRequest::createdAt, Comparator.reverseOrder()))
                .limit(limit)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<CorrectionRequest> getMine(UUID userId) {
        return correctionRequestPort.findByRequesterId(userId);
    }

    @Override
    public CorrectionRequest update(UpdateCorrectionRequestUseCase.Command command) {
        CorrectionRequest request = correctionRequestPort.findById(command.requestId())
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.REQUEST_NOT_FOUND));
        if (!request.isOwnedBy(command.requesterId())) {
            throw new ToneBridgeException(ErrorCode.UNAUTHORIZED);
        }
        if (!request.isPending() || correctionPort.existsByRequestId(command.requestId())) {
            throw new ToneBridgeException(ErrorCode.REQUEST_ALREADY_COMPLETED);
        }
        validateVariant(command.targetLanguage(), command.targetVariant());
        String contentText = request.type() == CorrectionType.TEXT ? command.contentText() : request.contentText();
        if (request.type() == CorrectionType.TEXT && (contentText == null || contentText.isBlank())) {
            throw new ToneBridgeException(ErrorCode.INVALID_INPUT);
        }
        return correctionRequestPort.updateContent(
                command.requestId(),
                command.targetLanguage(),
                command.targetVariant(),
                contentText,
                command.context(),
                command.feedbackGoals() != null ? command.feedbackGoals() : List.of()
        );
    }

    @Override
    public void delete(UUID requestId, UUID requesterId) {
        CorrectionRequest request = correctionRequestPort.findById(requestId)
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.REQUEST_NOT_FOUND));
        if (!request.isOwnedBy(requesterId)) {
            throw new ToneBridgeException(ErrorCode.UNAUTHORIZED);
        }
        if (!request.isPending() || correctionPort.existsByRequestId(requestId)) {
            throw new ToneBridgeException(ErrorCode.REQUEST_ALREADY_COMPLETED);
        }
        correctionRequestPort.softDelete(requestId);
    }
}
