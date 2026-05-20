package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.in.CreateStudySessionUseCase;
import me.yeonjae.tonebridge.application.port.in.GetStudySessionsUseCase;
import me.yeonjae.tonebridge.application.port.out.StudySessionPort;
import me.yeonjae.tonebridge.application.port.out.UserPort;
import me.yeonjae.tonebridge.domain.session.SessionStatus;
import me.yeonjae.tonebridge.domain.session.StudySession;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional
@RequiredArgsConstructor
public class StudySessionService implements CreateStudySessionUseCase, GetStudySessionsUseCase {

    private final StudySessionPort sessionPort;
    private final UserPort userPort;

    @Override
    public StudySession create(CreateStudySessionUseCase.Command command) {
        userPort.findById(command.friendId())
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.USER_NOT_FOUND));

        StudySession newSession = new StudySession(
                null,
                command.title(),
                command.creatorId(),
                List.of(command.creatorId(), command.friendId()),
                SessionStatus.ACTIVE,
                null
        );
        return sessionPort.save(newSession);
    }

    @Override
    @Transactional(readOnly = true)
    public List<StudySession> getSessions(UUID userId) {
        return sessionPort.findByMemberId(userId);
    }

    @Override
    @Transactional(readOnly = true)
    public StudySession getSession(UUID sessionId, UUID requesterId) {
        StudySession session = sessionPort.findById(sessionId)
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.SESSION_NOT_FOUND));

        if (!session.hasMember(requesterId)) {
            throw new ToneBridgeException(ErrorCode.NOT_SESSION_MEMBER);
        }
        return session;
    }
}
