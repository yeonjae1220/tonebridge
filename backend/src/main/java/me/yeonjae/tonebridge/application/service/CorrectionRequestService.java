package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.in.GetCorrectionFeedUseCase;
import me.yeonjae.tonebridge.application.port.in.GetMyCorrectionRequestsUseCase;
import me.yeonjae.tonebridge.application.port.in.SubmitAudioCorrectionRequestUseCase;
import me.yeonjae.tonebridge.application.port.in.SubmitTextCorrectionRequestUseCase;
import me.yeonjae.tonebridge.application.port.out.CorrectionRequestPort;
import me.yeonjae.tonebridge.application.port.out.CreditPort;
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

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
@RequiredArgsConstructor
public class CorrectionRequestService implements
        SubmitTextCorrectionRequestUseCase,
        SubmitAudioCorrectionRequestUseCase,
        GetCorrectionFeedUseCase,
        GetMyCorrectionRequestsUseCase {

    private final CorrectionRequestPort correctionRequestPort;
    private final CreditPort creditPort;
    private final UserPort userPort;
    private final ToneBridgeProperties properties;

    @Override
    public CorrectionRequest submit(SubmitTextCorrectionRequestUseCase.Command command) {
        int cost = properties.getCredit().getTextRequestCost();
        creditPort.adjustCredits(command.requesterId(), -cost);
        creditPort.save(new CreditTransaction(null, command.requesterId(), -cost,
                TransactionType.SPEND, null, "텍스트 교정 요청", null));

        CorrectionRequest request = new CorrectionRequest(
                null, command.requesterId(), CorrectionType.TEXT,
                command.contentText(), null, command.targetLanguage(),
                command.context(),
                command.feedbackGoals() != null ? command.feedbackGoals() : List.of(),
                cost, RequestStatus.PENDING, null, null, null
        );
        return correctionRequestPort.save(request);
    }

    @Override
    public CorrectionRequest submit(SubmitAudioCorrectionRequestUseCase.Command command) {
        int cost = properties.getCredit().getAudioRequestCost();
        creditPort.adjustCredits(command.requesterId(), -cost);
        creditPort.save(new CreditTransaction(null, command.requesterId(), -cost,
                TransactionType.SPEND, null, "음성 교정 요청", null));

        CorrectionRequest request = new CorrectionRequest(
                null, command.requesterId(), CorrectionType.AUDIO,
                null, command.audioKey(), command.targetLanguage(),
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

        List<String> languages = new ArrayList<>(corrector.fluentLanguages());
        languages.add(corrector.nativeLanguage());

        return correctionRequestPort.findFeed(correctorId, languages, limit);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CorrectionRequest> getMine(UUID userId) {
        return correctionRequestPort.findByRequesterId(userId);
    }
}
