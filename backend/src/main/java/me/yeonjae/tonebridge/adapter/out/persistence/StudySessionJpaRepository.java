package me.yeonjae.tonebridge.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StudySessionJpaRepository extends JpaRepository<StudySessionEntity, UUID> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM StudySessionEntity s WHERE s.id = :id AND s.deletedAt IS NULL")
    Optional<StudySessionEntity> lockActiveById(UUID id);

    @Query("""
            SELECT s.id FROM StudySessionEntity s WHERE s.deletedAt IS NULL
            AND EXISTS (SELECT m FROM SessionMemberEntity m WHERE m.sessionId = s.id AND m.userId = :userId)
            AND EXISTS (SELECT m FROM SessionMemberEntity m WHERE m.sessionId = s.id AND m.userId = :friendId)
            ORDER BY s.id
            """)
    List<UUID> findSharedIds(UUID userId, UUID friendId);


    @Query("""
            SELECT DISTINCT s FROM StudySessionEntity s
            LEFT JOIN FETCH s.members
            WHERE s.deletedAt IS NULL
              AND s.id IN (
                SELECT sm.sessionId FROM SessionMemberEntity sm
                WHERE sm.userId = :userId
            )
            ORDER BY s.createdAt DESC, s.id DESC
            """)
    List<StudySessionEntity> findByMemberUserId(UUID userId);

    @Query("""
            SELECT s FROM StudySessionEntity s
            LEFT JOIN FETCH s.members
            WHERE s.id = :id
              AND s.deletedAt IS NULL
            """)
    Optional<StudySessionEntity> findByIdWithMembers(UUID id);
}
