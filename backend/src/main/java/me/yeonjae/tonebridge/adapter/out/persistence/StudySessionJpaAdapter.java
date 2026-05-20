package me.yeonjae.tonebridge.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.StudySessionPort;
import me.yeonjae.tonebridge.domain.session.StudySession;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Transactional
public class StudySessionJpaAdapter implements StudySessionPort {

    private final StudySessionJpaRepository sessionRepository;

    @Override
    public StudySession save(StudySession session) {
        StudySessionEntity entity = StudySessionEntity.fromDomain(session);
        StudySessionEntity saved = sessionRepository.save(entity);

        for (UUID memberId : session.memberIds()) {
            SessionMemberEntity member = SessionMemberEntity.builder()
                    .sessionId(saved.getId())
                    .userId(memberId)
                    .build();
            saved.getMembers().add(member);
        }

        return sessionRepository.save(saved).toDomain();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<StudySession> findById(UUID id) {
        return sessionRepository.findByIdWithMembers(id).map(StudySessionEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<StudySession> findByMemberId(UUID userId) {
        return sessionRepository.findByMemberUserId(userId)
                .stream().map(StudySessionEntity::toDomain).toList();
    }
}
