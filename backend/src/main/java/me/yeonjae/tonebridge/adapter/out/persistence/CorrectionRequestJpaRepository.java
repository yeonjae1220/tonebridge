package me.yeonjae.tonebridge.adapter.out.persistence;

import jakarta.persistence.LockModeType;
import me.yeonjae.tonebridge.domain.correction.RequestStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CorrectionRequestJpaRepository extends JpaRepository<CorrectionRequestEntity, UUID> {

    @Query("""
            SELECT r FROM CorrectionRequestEntity r
            WHERE r.status = 'PENDING'
              AND r.deletedAt IS NULL
              AND r.requesterId <> :correctorId
              AND r.targetLanguage IN :languages
            ORDER BY r.createdAt DESC
            """)
    List<CorrectionRequestEntity> findFeed(
            @Param("correctorId") UUID correctorId,
            @Param("languages") List<String> languages,
            Pageable pageable
    );

    @Query("SELECT r FROM CorrectionRequestEntity r WHERE r.id = :id AND r.deletedAt IS NULL")
    Optional<CorrectionRequestEntity> findActiveById(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM CorrectionRequestEntity r WHERE r.id = :id AND r.deletedAt IS NULL")
    Optional<CorrectionRequestEntity> findActiveByIdForUpdate(@Param("id") UUID id);

    Optional<CorrectionRequestEntity> findByAudioUrlAndDeletedAtIsNull(String audioUrl);

    List<CorrectionRequestEntity> findByRequesterIdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID requesterId);

    @Modifying
    @Query("UPDATE CorrectionRequestEntity r SET r.status = :status WHERE r.id = :id AND r.deletedAt IS NULL")
    void updateStatus(@Param("id") UUID id, @Param("status") RequestStatus status);

    @Modifying
    @Query("""
            UPDATE CorrectionRequestEntity r
            SET r.status = 'COMPLETED', r.acceptedCorrectionId = :correctionId
            WHERE r.id = :requestId AND r.deletedAt IS NULL
            """)
    void updateAcceptedCorrection(@Param("requestId") UUID requestId, @Param("correctionId") UUID correctionId);

    long countByDeletedAtIsNull();

    long countByStatusAndDeletedAtIsNull(RequestStatus status);

    @Query("""
            SELECT r FROM CorrectionRequestEntity r
            WHERE r.status = 'PENDING'
              AND r.deletedAt IS NULL
              AND r.createdAt < :threshold
              AND NOT EXISTS (
                SELECT 1 FROM CorrectionEntity c WHERE c.requestId = r.id AND c.deletedAt IS NULL
              )
            """)
    List<CorrectionRequestEntity> findPendingOlderThan(@Param("threshold") Instant threshold, Pageable pageable);

    @Query("""
            SELECT r.targetLanguage, COUNT(r)
            FROM CorrectionRequestEntity r
            WHERE r.status = 'PENDING'
              AND r.deletedAt IS NULL
            GROUP BY r.targetLanguage
            """)
    List<Object[]> countPendingGroupedByLanguage();
}
