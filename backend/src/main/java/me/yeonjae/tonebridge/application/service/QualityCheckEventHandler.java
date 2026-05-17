package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.yeonjae.tonebridge.application.port.out.CorrectionPort;
import me.yeonjae.tonebridge.application.port.out.CreditPort;
import me.yeonjae.tonebridge.application.port.out.FcmNotificationPort;
import me.yeonjae.tonebridge.application.port.out.NotificationPort;
import me.yeonjae.tonebridge.domain.correction.CorrectionStatus;
import me.yeonjae.tonebridge.domain.credit.CreditTransaction;
import me.yeonjae.tonebridge.domain.credit.TransactionType;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Component
@RequiredArgsConstructor
public class QualityCheckEventHandler {

    private final CreditPort creditPort;
    private final CorrectionPort correctionPort;
    private final NotificationPort notificationPort;
    private final FcmNotificationPort fcmNotificationPort;
    private final StreakService streakService;
    private final BadgeService badgeService;

    @EventListener
    @Transactional
    public void handle(QualityCheckCompletedEvent event) {
        if (event.passed()) {
            String rewardNote = event.isAudio() ? "음성 첨삭 보상" : "텍스트 첨삭 보상";
            creditPort.adjustCredits(event.correctorId(), event.reward());
            creditPort.save(new CreditTransaction(null, event.correctorId(), event.reward(),
                    TransactionType.EARN, event.correctionId(), rewardNote, null));
            notificationPort.sendCorrectionReady(event.requesterId(), event.correctionId());

            try {
                fcmNotificationPort.sendCorrectionReady(event.requesterId(), event.correctionId());
            } catch (Exception e) {
                log.warn("FCM notification failed for requesterId={}: {}", event.requesterId(), e.getMessage());
            }

            try {
                int newStreak = streakService.recordCorrection(event.correctorId());
                badgeService.evaluateAfterCorrection(event.correctorId(), newStreak);
            } catch (Exception e) {
                // Gamification failure must not roll back credit reward
                log.error("Gamification update failed for correctorId={}: {}",
                        event.correctorId(), e.getMessage(), e);
            }
        } else {
            correctionPort.updateStatus(event.correctionId(), CorrectionStatus.REJECTED);
        }
    }
}
