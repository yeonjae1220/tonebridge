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

    private final FcmNotificationPort fcmNotificationPort;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onCorrectionNoteAdded(CorrectionNoteAddedEvent event) {
        try {
            fcmNotificationPort.sendCorrectionNoteAdded(
                    event.learnerId(), event.cardId(), event.reviewerUsername());
        } catch (Exception e) {
            log.warn("FCM notification failed for correction note: cardId={}, learnerId={}",
                    event.cardId(), event.learnerId(), e);
        }
    }
}
