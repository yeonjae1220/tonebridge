package me.yeonjae.tonebridge.application.service;

import me.yeonjae.tonebridge.application.port.out.AiQualityCheckPort;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class CorrectionQualityCheckListenerTest {

    @Mock
    private AiQualityCheckPort aiQualityCheckPort;

    @Test
    void forwardsSubmittedEventToQualityCheckPort() {
        UUID correctionId = UUID.randomUUID();
        UUID correctorId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        CorrectionQualityCheckListener listener = new CorrectionQualityCheckListener(aiQualityCheckPort);

        listener.onCorrectionSubmitted(new CorrectionSubmittedEvent(
                correctionId, correctorId, requesterId,
                "original", "corrected", "explanation", 4, false));

        verify(aiQualityCheckPort).checkQualityAsync(
                correctionId, correctorId, requesterId,
                "original", "corrected", "explanation", 4, false);
    }

    /**
     * 검사가 커밋 전에 실행되는지는 Spring 컨텍스트 없이 관찰할 수 없어, 실행 시점을 결정하는
     * 애노테이션을 대신 고정한다. 이 설정이 빠지면 커밋 전에 나온 REJECTED 가 조용히 사라지는
     * 문제가 그대로 재발한다.
     */
    @Test
    void qualityCheckIsWiredToRunAfterCommit() throws NoSuchMethodException {
        TransactionalEventListener annotation = CorrectionQualityCheckListener.class
                .getMethod("onCorrectionSubmitted", CorrectionSubmittedEvent.class)
                .getAnnotation(TransactionalEventListener.class);

        assertThat(annotation).isNotNull();
        assertThat(annotation.phase()).isEqualTo(TransactionPhase.AFTER_COMMIT);
        assertThat(annotation.fallbackExecution()).isTrue();
    }
}
