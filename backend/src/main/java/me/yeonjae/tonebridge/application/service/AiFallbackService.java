package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.yeonjae.tonebridge.application.port.out.CorrectionRequestPort;
import me.yeonjae.tonebridge.domain.correction.CorrectionRequest;
import me.yeonjae.tonebridge.shared.config.ToneBridgeProperties;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiFallbackService {

    private final ToneBridgeProperties properties;
    private final CorrectionRequestPort correctionRequestPort;
    private final AiFallbackProcessor processor;

    public void processFallbacks() {
        if (!properties.getAi().isEnabled()) {
            log.debug("AI fallback skipped because tonebridge.ai.enabled=false");
            return;
        }

        ToneBridgeProperties.Correction correctionProps = properties.getCorrection();
        int fallbackHours = correctionProps.getAiFallbackAfterHours();
        int batchSize = correctionProps.getFallbackBatchSize();
        Instant threshold = Instant.now().minus(fallbackHours, ChronoUnit.HOURS);

        List<CorrectionRequest> candidates = correctionRequestPort.findPendingOlderThan(threshold, batchSize);
        log.info("AI fallback: found {} expired PENDING requests (threshold={}h)", candidates.size(), fallbackHours);

        for (CorrectionRequest request : candidates) {
            try {
                processor.processSingleFallback(request);
            } catch (Exception e) {
                log.error("AI fallback failed for requestId={}: {}", request.id(), e.getMessage(), e);
            }
        }
    }
}
