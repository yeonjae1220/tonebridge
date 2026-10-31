package me.yeonjae.tonebridge.application.port.out;

import me.yeonjae.tonebridge.domain.session.StudySession;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StudySessionPort {
    StudySession save(StudySession session);
    Optional<StudySession> findById(UUID id);
    List<StudySession> findByMemberId(UUID userId);
    StudySession updateTitle(UUID id, String title);
    void softDelete(UUID id);
    Optional<StudySession> findByIdForUpdate(UUID id);
    void removeMember(UUID id, UUID userId);
    void closeSharedBetween(UUID userId, UUID friendId);
}
