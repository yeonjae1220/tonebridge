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

    // 방언 우선 정렬을 SQL 에서 한다. 예전처럼 최신 N×3 건을 가져와 메모리에서 재정렬하면
    // 그보다 오래된 PENDING 요청은 어떤 교정자에게도 안 보이고, 페이지 경계에서 순서가 깨진다.
    @Query("""
            SELECT r FROM CorrectionRequestEntity r
            WHERE r.status = 'PENDING'
              AND r.deletedAt IS NULL
              AND r.requesterId <> :correctorId
              AND r.targetLanguage IN :languages
            ORDER BY CASE WHEN r.targetVariant IN :variants THEN 1 ELSE 0 END DESC, r.createdAt DESC, r.id DESC
            """)
    List<CorrectionRequestEntity> findFeedFirstPage(
            @Param("correctorId") UUID correctorId,
            @Param("languages") List<String> languages,
            @Param("variants") List<String> variants,
            Pageable pageable
    );

    // 키셋: (preferred, createdAt, id) 가 커서보다 "뒤"(내림차순으로 작은) 것만. 페이지 도중 새 요청이
    // 들어와도 앞쪽에 붙을 뿐 이미 본 페이지와 겹치거나 빠지지 않는다.
    @Query("""
            SELECT r FROM CorrectionRequestEntity r
            WHERE r.status = 'PENDING'
              AND r.deletedAt IS NULL
              AND r.requesterId <> :correctorId
              AND r.targetLanguage IN :languages
              AND (
                    CASE WHEN r.targetVariant IN :variants THEN 1 ELSE 0 END < :cursorPreferred
                 OR (CASE WHEN r.targetVariant IN :variants THEN 1 ELSE 0 END = :cursorPreferred
                     AND (r.createdAt < :cursorCreatedAt
                          OR (r.createdAt = :cursorCreatedAt AND r.id < :cursorId)))
              )
            ORDER BY CASE WHEN r.targetVariant IN :variants THEN 1 ELSE 0 END DESC, r.createdAt DESC, r.id DESC
            """)
    List<CorrectionRequestEntity> findFeedPageAfter(
            @Param("correctorId") UUID correctorId,
            @Param("languages") List<String> languages,
            @Param("variants") List<String> variants,
            @Param("cursorPreferred") int cursorPreferred,
            @Param("cursorCreatedAt") Instant cursorCreatedAt,
            @Param("cursorId") UUID cursorId,
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
