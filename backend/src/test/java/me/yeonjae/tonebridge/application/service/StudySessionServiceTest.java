package me.yeonjae.tonebridge.application.service;

import me.yeonjae.tonebridge.application.port.in.CreateStudySessionUseCase;
import me.yeonjae.tonebridge.application.port.out.FriendPort;
import me.yeonjae.tonebridge.application.port.out.StudySessionPort;
import me.yeonjae.tonebridge.application.port.out.UserPort;
import me.yeonjae.tonebridge.domain.session.SessionStatus;
import me.yeonjae.tonebridge.domain.session.StudySession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StudySessionServiceTest {

    @Mock
    private StudySessionPort sessionPort;

    @Mock
    private UserPort userPort;

    @Mock
    private FriendPort friendPort;

    private StudySessionService service;

    @BeforeEach
    void setUp() {
        service = new StudySessionService(sessionPort, userPort, friendPort);
    }

    @Test
    void createsPersonalSessionWhenFriendIdIsNull() {
        UUID creatorId = UUID.randomUUID();
        UUID savedId = UUID.randomUUID();
        ArgumentCaptor<StudySession> captor = ArgumentCaptor.forClass(StudySession.class);

        when(sessionPort.save(any(StudySession.class))).thenAnswer(invocation -> {
            StudySession session = invocation.getArgument(0);
            return new StudySession(
                    savedId,
                    session.title(),
                    session.createdBy(),
                    session.memberIds(),
                    session.status(),
                    Instant.now()
            );
        });

        StudySession result = service.create(new CreateStudySessionUseCase.Command(
                creatorId,
                null,
                "내 연습장"
        ));

        verify(sessionPort).save(captor.capture());
        StudySession saved = captor.getValue();
        assertThat(saved.createdBy()).isEqualTo(creatorId);
        assertThat(saved.memberIds()).containsExactly(creatorId);
        assertThat(saved.status()).isEqualTo(SessionStatus.ACTIVE);
        assertThat(result.id()).isEqualTo(savedId);
        assertThat(result.memberIds()).containsExactly(creatorId);
        verify(userPort, never()).findById(any());
        verify(friendPort, never()).findAcceptedBetween(any(), any());
    }

    @Test
    void endSessionIsCompatibilityNoop() {
        UUID sessionId = UUID.randomUUID();
        UUID memberId = UUID.randomUUID();
        StudySession session = new StudySession(
                sessionId,
                "study",
                memberId,
                List.of(memberId),
                SessionStatus.ACTIVE,
                Instant.now()
        );

        when(sessionPort.findById(sessionId)).thenReturn(Optional.of(session));

        StudySession result = service.end(sessionId, memberId);

        assertThat(result).isEqualTo(session);
        verify(sessionPort, never()).save(any());
    }
}
