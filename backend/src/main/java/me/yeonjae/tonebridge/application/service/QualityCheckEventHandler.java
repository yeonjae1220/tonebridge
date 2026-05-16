package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.CorrectionPort;
import me.yeonjae.tonebridge.application.port.out.CreditPort;
import me.yeonjae.tonebridge.application.port.out.NotificationPort;
import me.yeonjae.tonebridge.domain.correction.CorrectionStatus;
import me.yeonjae.tonebridge.domain.credit.CreditTransaction;
import me.yeonjae.tonebridge.domain.credit.TransactionType;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class QualityCheckEventHandler {

    private final CreditPort creditPort;
    private final CorrectionPort correctionPort;
    private final NotificationPort notificationPort;

    @EventListener
    @Transactional
    public void handle(QualityCheckCompletedEvent event) {
        if (event.passed()) {
            creditPort.adjustCredits(event.correctorId(), event.reward());
            creditPort.save(new CreditTransaction(null, event.correctorId(), event.reward(),
                    TransactionType.EARN, event.correctionId(), "텍스트 첨삭 보상", null));
            notificationPort.sendCorrectionReady(event.requesterId(), event.correctionId());
        } else {
            correctionPort.updateStatus(event.correctionId(), CorrectionStatus.REJECTED);
        }
    }
}
