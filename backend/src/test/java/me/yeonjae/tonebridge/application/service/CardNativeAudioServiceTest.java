package me.yeonjae.tonebridge.application.service;

import me.yeonjae.tonebridge.application.port.in.AddCardNativeAudioUseCase;
import me.yeonjae.tonebridge.application.port.out.CardNativeAudioPort;
import me.yeonjae.tonebridge.application.port.out.StoragePort;
import me.yeonjae.tonebridge.application.port.out.StudyCardPort;
import me.yeonjae.tonebridge.application.port.out.StudySessionPort;
import me.yeonjae.tonebridge.domain.session.SessionStatus;
import me.yeonjae.tonebridge.domain.session.StudySession;
import me.yeonjae.tonebridge.domain.studycard.StudyCard;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CardNativeAudioServiceTest {

    @Mock
    private CardNativeAudioPort nativeAudioPort;

    @Mock
    private StudyCardPort cardPort;

    @Mock
    private StudySessionPort sessionPort;

    @Mock
    private StoragePort storagePort;

    private CardNativeAudioService service;

    @BeforeEach
    void setUp() {
        service = new CardNativeAudioService(nativeAudioPort, cardPort, sessionPort, storagePort);
    }

    @Test
    void webmNativeAudioUploadUrlUsesWebmContentType() {
        UUID cardId = UUID.randomUUID();
        UUID uploaderId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        StudyCard card = card(cardId, sessionId, uploaderId);
        StudySession session = session(sessionId, uploaderId);

        when(cardPort.findById(cardId)).thenReturn(Optional.of(card));
        when(sessionPort.findById(sessionId)).thenReturn(Optional.of(session));
        when(storagePort.generatePresignedUploadUrl(
                "native_123.webm", "audio/webm", Duration.ofMinutes(15)))
                .thenReturn(new StoragePort.PresignedUpload("https://upload.example", "audio/key.webm"));

        service.getUploadUrl(new AddCardNativeAudioUseCase.GetUrlCommand(
                cardId, uploaderId, "native_123.webm"));

        verify(storagePort).generatePresignedUploadUrl(
                "native_123.webm", "audio/webm", Duration.ofMinutes(15));
    }

    @Test
    void m4aNativeAudioUploadUrlUsesMp4ContentType() {
        UUID cardId = UUID.randomUUID();
        UUID uploaderId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        StudyCard card = card(cardId, sessionId, uploaderId);
        StudySession session = session(sessionId, uploaderId);

        when(cardPort.findById(cardId)).thenReturn(Optional.of(card));
        when(sessionPort.findById(sessionId)).thenReturn(Optional.of(session));
        when(storagePort.generatePresignedUploadUrl(
                "native_123.m4a", "audio/mp4", Duration.ofMinutes(15)))
                .thenReturn(new StoragePort.PresignedUpload("https://upload.example", "audio/key.m4a"));

        service.getUploadUrl(new AddCardNativeAudioUseCase.GetUrlCommand(
                cardId, uploaderId, "native_123.m4a"));

        verify(storagePort).generatePresignedUploadUrl(
                "native_123.m4a", "audio/mp4", Duration.ofMinutes(15));
    }

    @Test
    void canCreateNativeAudioUploadUrlForLegacyEndedSession() {
        UUID cardId = UUID.randomUUID();
        UUID uploaderId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        StudyCard card = card(cardId, sessionId, uploaderId);
        StudySession endedSession = new StudySession(
                sessionId,
                "study",
                uploaderId,
                List.of(uploaderId),
                SessionStatus.ENDED,
                Instant.now()
        );

        when(cardPort.findById(cardId)).thenReturn(Optional.of(card));
        when(sessionPort.findById(sessionId)).thenReturn(Optional.of(endedSession));
        when(storagePort.generatePresignedUploadUrl(
                "native_123.webm", "audio/webm", Duration.ofMinutes(15)))
                .thenReturn(new StoragePort.PresignedUpload("https://upload.example", "audio/key.webm"));

        service.getUploadUrl(new AddCardNativeAudioUseCase.GetUrlCommand(
                cardId, uploaderId, "native_123.webm"
        ));

        verify(storagePort).generatePresignedUploadUrl(
                "native_123.webm", "audio/webm", Duration.ofMinutes(15));
    }

    private StudyCard card(UUID cardId, UUID sessionId, UUID creatorId) {
        return new StudyCard(
                cardId,
                sessionId,
                creatorId,
                "hello",
                null,
                null,
                null,
                List.of(),
                0,
                Instant.now(),
                null,
                null
        );
    }

    private StudySession session(UUID sessionId, UUID memberId) {
        return new StudySession(
                sessionId,
                "study",
                memberId,
                List.of(memberId),
                SessionStatus.ACTIVE,
                Instant.now()
        );
    }
}
