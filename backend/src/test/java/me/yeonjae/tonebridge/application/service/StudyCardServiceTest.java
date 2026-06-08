package me.yeonjae.tonebridge.application.service;

import me.yeonjae.tonebridge.application.port.in.CreateStudyCardUseCase;
import me.yeonjae.tonebridge.application.port.in.MoveStudyCardUseCase;
import me.yeonjae.tonebridge.application.port.out.FcmNotificationPort;
import me.yeonjae.tonebridge.application.port.out.CardNativeAudioPort;
import me.yeonjae.tonebridge.application.port.out.LearnerAttemptPort;
import me.yeonjae.tonebridge.application.port.out.StoragePort;
import me.yeonjae.tonebridge.application.port.out.StudyCardPort;
import me.yeonjae.tonebridge.application.port.out.StudySessionPort;
import me.yeonjae.tonebridge.application.port.out.UserPort;
import me.yeonjae.tonebridge.domain.session.SessionStatus;
import me.yeonjae.tonebridge.domain.session.StudySession;
import me.yeonjae.tonebridge.domain.studycard.CardNativeAudio;
import me.yeonjae.tonebridge.domain.studycard.LearnerAttempt;
import me.yeonjae.tonebridge.domain.studycard.StudyCard;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StudyCardServiceTest {

    @Mock
    private StudyCardPort cardPort;

    @Mock
    private LearnerAttemptPort attemptPort;

    @Mock
    private CardNativeAudioPort nativeAudioPort;

    @Mock
    private StudySessionPort sessionPort;

    @Mock
    private StoragePort storagePort;

    @Mock
    private UserPort userPort;

    @Mock
    private FcmNotificationPort fcmNotificationPort;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    private StudyCardService service;

    @BeforeEach
    void setUp() {
        service = new StudyCardService(
                cardPort,
                attemptPort,
                nativeAudioPort,
                sessionPort,
                storagePort,
                userPort,
                fcmNotificationPort,
                eventPublisher
        );
    }

    @Test
    void canCreateCardInLegacyEndedSession() {
        UUID sessionId = UUID.randomUUID();
        UUID creatorId = UUID.randomUUID();
        StudyCard savedCard = card(UUID.randomUUID(), sessionId, creatorId, null);

        when(sessionPort.findById(sessionId)).thenReturn(Optional.of(session(sessionId, creatorId, SessionStatus.ENDED)));
        when(cardPort.findBySessionId(sessionId)).thenReturn(List.of());
        when(cardPort.save(org.mockito.ArgumentMatchers.any())).thenReturn(savedCard);

        StudyCard result = service.create(new CreateStudyCardUseCase.Command(
                sessionId, creatorId, "hello", null, List.of()
        ));

        assertThat(result).isEqualTo(savedCard);
        verify(cardPort).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void cannotMoveCardWithLearningHistoryToAnotherSession() {
        UUID creatorId = UUID.randomUUID();
        UUID cardId = UUID.randomUUID();
        UUID sourceSessionId = UUID.randomUUID();
        UUID targetSessionId = UUID.randomUUID();
        StudyCard card = card(cardId, sourceSessionId, creatorId, null);

        when(cardPort.findById(cardId)).thenReturn(Optional.of(card));
        when(sessionPort.findById(sourceSessionId))
                .thenReturn(Optional.of(session(sourceSessionId, creatorId, SessionStatus.ACTIVE)));
        when(sessionPort.findById(targetSessionId))
                .thenReturn(Optional.of(session(targetSessionId, creatorId, SessionStatus.ACTIVE)));
        when(attemptPort.findByCardId(cardId)).thenReturn(List.of(attempt(cardId, UUID.randomUUID())));

        assertThatThrownBy(() -> service.move(new MoveStudyCardUseCase.Command(
                cardId, creatorId, targetSessionId, 0
        )))
                .isInstanceOf(ToneBridgeException.class)
                .extracting(e -> ((ToneBridgeException) e).getErrorCode())
                .isEqualTo(ErrorCode.CARD_HAS_HISTORY);
        verify(cardPort, never()).move(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyInt());
    }

    @Test
    void canReorderCardWithLearningHistoryWithinSameSession() {
        UUID creatorId = UUID.randomUUID();
        UUID cardId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        StudyCard card = card(cardId, sessionId, creatorId, null);

        when(cardPort.findById(cardId)).thenReturn(Optional.of(card));
        when(sessionPort.findById(sessionId)).thenReturn(Optional.of(session(sessionId, creatorId, SessionStatus.ACTIVE)));
        when(cardPort.move(cardId, sessionId, 1)).thenReturn(card);

        service.move(new MoveStudyCardUseCase.Command(cardId, creatorId, sessionId, 1));

        verify(cardPort).move(cardId, sessionId, 1);
        verify(attemptPort, never()).findByCardId(cardId);
        verify(nativeAudioPort, never()).findAllByCardId(cardId);
    }

    @Test
    void cannotMoveCardWithNativeAudioHistoryToAnotherSession() {
        UUID creatorId = UUID.randomUUID();
        UUID cardId = UUID.randomUUID();
        UUID sourceSessionId = UUID.randomUUID();
        UUID targetSessionId = UUID.randomUUID();
        StudyCard card = card(cardId, sourceSessionId, creatorId, null);

        when(cardPort.findById(cardId)).thenReturn(Optional.of(card));
        when(sessionPort.findById(sourceSessionId))
                .thenReturn(Optional.of(session(sourceSessionId, creatorId, SessionStatus.ACTIVE)));
        when(sessionPort.findById(targetSessionId))
                .thenReturn(Optional.of(session(targetSessionId, creatorId, SessionStatus.ACTIVE)));
        when(attemptPort.findByCardId(cardId)).thenReturn(List.of());
        when(nativeAudioPort.findAllByCardId(cardId))
                .thenReturn(List.of(new CardNativeAudio(UUID.randomUUID(), cardId, "audio/key.webm", Instant.now(), null)));

        assertThatThrownBy(() -> service.move(new MoveStudyCardUseCase.Command(
                cardId, creatorId, targetSessionId, 0
        )))
                .isInstanceOf(ToneBridgeException.class)
                .extracting(e -> ((ToneBridgeException) e).getErrorCode())
                .isEqualTo(ErrorCode.CARD_HAS_HISTORY);
        verify(cardPort, never()).move(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyInt());
    }

    @Test
    void canMoveCardIntoLegacyEndedSession() {
        UUID creatorId = UUID.randomUUID();
        UUID cardId = UUID.randomUUID();
        UUID sourceSessionId = UUID.randomUUID();
        UUID targetSessionId = UUID.randomUUID();
        StudyCard card = card(cardId, sourceSessionId, creatorId, null);

        when(cardPort.findById(cardId)).thenReturn(Optional.of(card));
        when(sessionPort.findById(sourceSessionId))
                .thenReturn(Optional.of(session(sourceSessionId, creatorId, SessionStatus.ACTIVE)));
        when(sessionPort.findById(targetSessionId))
                .thenReturn(Optional.of(session(targetSessionId, creatorId, SessionStatus.ENDED)));
        when(attemptPort.findByCardId(cardId)).thenReturn(List.of());
        when(nativeAudioPort.findAllByCardId(cardId)).thenReturn(List.of());
        when(cardPort.move(cardId, targetSessionId, 0)).thenReturn(card);

        StudyCard result = service.move(new MoveStudyCardUseCase.Command(
                cardId, creatorId, targetSessionId, 0
        ));

        assertThat(result).isEqualTo(card);
        verify(cardPort).move(cardId, targetSessionId, 0);
    }

    private StudyCard card(UUID cardId, UUID sessionId, UUID creatorId, String nativeAudioUrl) {
        return new StudyCard(
                cardId,
                sessionId,
                creatorId,
                "hello",
                null,
                nativeAudioUrl,
                null,
                List.of(),
                0,
                Instant.now(),
                null,
                null
        );
    }

    private LearnerAttempt attempt(UUID cardId, UUID learnerId) {
        return new LearnerAttempt(UUID.randomUUID(), cardId, learnerId, "audio/key.webm", null, null, Instant.now());
    }

    private StudySession session(UUID sessionId, UUID memberId, SessionStatus status) {
        return new StudySession(
                sessionId,
                "study",
                memberId,
                List.of(memberId),
                status,
                Instant.now()
        );
    }
}
