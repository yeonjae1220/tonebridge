package me.yeonjae.tonebridge.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StudySessionJpaRepository extends JpaRepository<StudySessionEntity, UUID> {

    @Query("""
            SELECT DISTINCT s FROM StudySessionEntity s
            LEFT JOIN FETCH s.members
            WHERE s.id IN (
                SELECT sm.sessionId FROM SessionMemberEntity sm
                WHERE sm.userId = :userId
            )
            ORDER BY s.createdAt DESC
            """)
    List<StudySessionEntity> findByMemberUserId(UUID userId);

    @Query("""
            SELECT s FROM StudySessionEntity s
            LEFT JOIN FETCH s.members
            WHERE s.id = :id
            """)
    Optional<StudySessionEntity> findByIdWithMembers(UUID id);
}
