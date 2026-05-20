package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.yeonjae.tonebridge.application.port.out.FcmNotificationPort;
import me.yeonjae.tonebridge.shared.event.CorrectionNoteAddedEvent;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Slf4j
@Component
@RequiredArgsConstructor
public class CorrectionNotificationListener {

    private static final int MAX_ATTEMPTS = 3;
    private static final long RETRY_DELAY_MS = 1_000;

    private final FcmNotificationPort fcmNotificationPort;

    @Async("fcmNotificationExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onCorrectionNoteAdded(CorrectionNoteAddedEvent event) {
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                fcmNotificationPort.sendCorrectionNoteAdded(
                        event.learnerId(), event.sessionId(), event.cardId(), event.reviewerUsername());
                return; // success
            } catch (Exception e) {
                log.warn("FCM notification attempt {}/{} failed: cardId={}, learnerId={}",
                        attempt, MAX_ATTEMPTS, event.cardId(), event.learnerId(), e);
                if (attempt < MAX_ATTEMPTS) {
                    try {
                        Thread.sleep(RETRY_DELAY_MS * attempt); // linear back-off
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        log.warn("FCM retry interrupted for cardId={}", event.cardId());
                        return;
                    }
                }
            }
        }
        log.error("FCM notification permanently failed after {} attempts: cardId={}, learnerId={}",
                MAX_ATTEMPTS, event.cardId(), event.learnerId());
    }
}
