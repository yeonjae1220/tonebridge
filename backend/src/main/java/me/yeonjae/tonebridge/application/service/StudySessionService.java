package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.in.CreateStudySessionUseCase;
import me.yeonjae.tonebridge.application.port.in.DeleteStudySessionUseCase;
import me.yeonjae.tonebridge.application.port.in.EndStudySessionUseCase;
import me.yeonjae.tonebridge.application.port.in.GetStudySessionsUseCase;
import me.yeonjae.tonebridge.application.port.in.UpdateStudySessionUseCase;
import me.yeonjae.tonebridge.application.port.out.FriendPort;
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
public class StudySessionService implements
        CreateStudySessionUseCase,
        GetStudySessionsUseCase,
        EndStudySessionUseCase,
        UpdateStudySessionUseCase,
        DeleteStudySessionUseCase {

    private final StudySessionPort sessionPort;
    private final UserPort userPort;
    private final FriendPort friendPort;

    @Override
    public StudySession create(CreateStudySessionUseCase.Command command) {
        if (command.friendId() == null || command.friendId().equals(command.creatorId())) {
            StudySession personalSession = new StudySession(
                    null,
                    command.title(),
                    command.creatorId(),
                    List.of(command.creatorId()),
                    SessionStatus.ACTIVE,
                    null
            );
            return sessionPort.save(personalSession);
        }

        userPort.findById(command.friendId())
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.USER_NOT_FOUND));

        // Ensure the two users are actually friends before creating a shared session
        friendPort.findAcceptedBetween(command.creatorId(), command.friendId())
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.NOT_FRIENDS));

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

    @Override
    public StudySession end(UUID sessionId, UUID requesterId) {
        StudySession session = sessionPort.findById(sessionId)
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.SESSION_NOT_FOUND));

        if (!session.hasMember(requesterId)) {
            throw new ToneBridgeException(ErrorCode.NOT_SESSION_MEMBER);
        }
        return session;
    }

    @Override
    public StudySession update(UUID sessionId, UUID requesterId, String title) {
        StudySession session = sessionPort.findById(sessionId)
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.SESSION_NOT_FOUND));
        requireCreator(session, requesterId);
        return sessionPort.updateTitle(sessionId, title);
    }

    @Override
    public void delete(UUID sessionId, UUID requesterId) {
        StudySession session = sessionPort.findById(sessionId)
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.SESSION_NOT_FOUND));
        requireCreator(session, requesterId);
        sessionPort.softDelete(sessionId);
    }

    private void requireCreator(StudySession session, UUID requesterId) {
        if (!session.createdBy().equals(requesterId)) {
            throw new ToneBridgeException(ErrorCode.UNAUTHORIZED);
        }
    }
}
