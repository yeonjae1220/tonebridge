package me.yeonjae.tonebridge.application.service;

import me.yeonjae.tonebridge.application.port.out.CorrectionPort;
import me.yeonjae.tonebridge.application.port.out.CreditPort;
import me.yeonjae.tonebridge.application.port.out.FcmNotificationPort;
import me.yeonjae.tonebridge.application.port.out.NotificationPort;
import me.yeonjae.tonebridge.domain.correction.CorrectionStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class QualityCheckEventHandlerTest {

    @Mock
    private CreditPort creditPort;

    @Mock
    private CorrectionPort correctionPort;

    @Mock
    private NotificationPort notificationPort;

    @Mock
    private FcmNotificationPort fcmNotificationPort;

    @Mock
    private StreakService streakService;

    @Mock
    private BadgeService badgeService;

    private QualityCheckEventHandler handler;

    @BeforeEach
    void setUp() {
        handler = new QualityCheckEventHandler(
                creditPort, correctionPort, notificationPort, fcmNotificationPort,
                streakService, badgeService);
    }

    @Test
    void failedCheckRejectsCorrectionOnlyWhileItIsStillSubmitted() {
        UUID correctionId = UUID.randomUUID();
        UUID correctorId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(correctionPort.updateStatusIfCurrent(
                correctionId, CorrectionStatus.SUBMITTED, CorrectionStatus.REJECTED)).thenReturn(true);

        handler.handle(new QualityCheckCompletedEvent(correctionId, correctorId, requesterId, false, 4, false));

        verify(correctionPort).updateStatusIfCurrent(
                correctionId, CorrectionStatus.SUBMITTED, CorrectionStatus.REJECTED);
        verify(creditPort, never()).adjustCredits(any(), anyInt());
    }

    @Test
    void failedCheckDoesNotOverwriteACorrectionTheRequesterAlreadyAccepted() {
        UUID correctionId = UUID.randomUUID();
        UUID correctorId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        // 요청자가 검사보다 먼저 채택해 APPROVED 가 된 상태 — 조건부 전이가 실패한다.
        when(correctionPort.updateStatusIfCurrent(
                correctionId, CorrectionStatus.SUBMITTED, CorrectionStatus.REJECTED)).thenReturn(false);

        handler.handle(new QualityCheckCompletedEvent(correctionId, correctorId, requesterId, false, 4, false));

        // 상태를 되돌리려는 추가 시도도, 크레딧 변경도 없어야 한다.
        verify(creditPort, never()).save(any());
        verify(creditPort, never()).adjustCredits(any(), anyInt());
    }

    @Test
    void passedCheckRewardsCorrectorAndLeavesStatusAlone() {
        UUID correctionId = UUID.randomUUID();
        UUID correctorId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();

        handler.handle(new QualityCheckCompletedEvent(correctionId, correctorId, requesterId, true, 4, false));

        verify(creditPort).adjustCredits(correctorId, 4);
        verify(notificationPort).sendCorrectionReady(requesterId, correctionId);
        verify(correctionPort, never()).updateStatusIfCurrent(any(), any(), any());
    }
}
