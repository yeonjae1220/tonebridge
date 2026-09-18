package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.yeonjae.tonebridge.application.port.out.AiQualityCheckPort;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 교정 저장 트랜잭션이 커밋된 뒤에 AI 품질 검사를 시작한다.
 *
 * <p>검사 자체는 어댑터에서 비동기로 돌기 때문에 이 리스너는 즉시 반환한다.
 * {@link CorrectionNotificationListener} 와 같은 방식(커밋 후 실행)이다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CorrectionQualityCheckListener {

    private final AiQualityCheckPort aiQualityCheckPort;

    /**
     * fallbackExecution = true — 트랜잭션 없이 발행된 경우에도 검사를 건너뛰지 않는다.
     * 기본값(false)은 이벤트를 조용히 버리는데, 그러면 교정이 검사 없이 영원히 대기 상태로 남는다.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onCorrectionSubmitted(CorrectionSubmittedEvent event) {
        log.debug("커밋 완료, 품질 검사 시작: correctionId={}", event.correctionId());
        aiQualityCheckPort.checkQualityAsync(
                event.correctionId(), event.correctorId(), event.requesterId(),
                event.originalText(), event.correctedText(), event.explanation(),
                event.reward(), event.isAudio()
        );
    }
}
