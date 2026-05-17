package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.yeonjae.tonebridge.application.port.out.AiFallbackPort;
import me.yeonjae.tonebridge.application.port.out.CorrectionPort;
import me.yeonjae.tonebridge.application.port.out.CorrectionRequestPort;
import me.yeonjae.tonebridge.application.port.out.FcmNotificationPort;
import me.yeonjae.tonebridge.domain.correction.Correction;
import me.yeonjae.tonebridge.domain.correction.CorrectionRequest;
import me.yeonjae.tonebridge.domain.correction.CorrectionStatus;
import me.yeonjae.tonebridge.domain.correction.RequestStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class AiFallbackProcessor {

    private final CorrectionRequestPort correctionRequestPort;
    private final CorrectionPort correctionPort;
    private final AiFallbackPort aiFallbackPort;
    private final FcmNotificationPort fcmNotificationPort;

    @Transactional
    public void processSingleFallback(CorrectionRequest request) {
        if (correctionPort.existsByRequestId(request.id())) {
            log.debug("Skipping requestId={} — correction already exists", request.id());
            return;
        }

        AiFallbackPort.FallbackResult result = aiFallbackPort.generateFallback(
                request.contentText(),
                request.targetLanguage(),
                request.context()
        );

        Correction correction = new Correction(
                null,
                request.id(),
                null,
                true,
                result.correctedText(),
                result.explanation(),
                List.of(),
                List.of(),
                null, null, null,
                null,
                0,
                CorrectionStatus.APPROVED,
                null
        );
        Correction saved = correctionPort.save(correction);
        correctionRequestPort.updateStatus(request.id(), RequestStatus.AI_COMPLETED);

        log.info("AI fallback applied: requestId={}, correctionId={}", request.id(), saved.id());

        try {
            fcmNotificationPort.sendCorrectionReady(request.requesterId(), saved.id());
        } catch (Exception e) {
            log.warn("FCM notification failed after AI fallback for requesterId={}: {}",
                    request.requesterId(), e.getMessage());
        }
    }
}
