package me.yeonjae.tonebridge.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Set;
import java.util.UUID;

public interface CorrectionLikeJpaRepository extends JpaRepository<CorrectionLikeJpaEntity, UUID> {

    /**
     * 유니크 제약 {@code uq_correction_like} 에 걸리면 조용히 넘어간다.
     * 저장 후 {@code DataIntegrityViolationException} 을 잡는 방식은 쓰지 말 것 — PostgreSQL 은 위반 순간
     * 트랜잭션을 aborted 로 만들고, INSERT 가 flush 까지 미뤄져 catch 밖에서 터진다(GLOBAL-PIT-184).
     */
    @Modifying
    @Query(value = """
            INSERT INTO correction_likes (id, correction_id, user_id, created_at)
            VALUES (:id, :correctionId, :userId, CURRENT_TIMESTAMP)
            ON CONFLICT (correction_id, user_id) DO NOTHING
            """, nativeQuery = true)
    int insertIfAbsent(@Param("id") UUID id, @Param("correctionId") UUID correctionId, @Param("userId") UUID userId);

    // 파생 delete(조회 후 엔티티별 삭제)는 동시 삭제 시 flush 에서 0행 갱신 예외가 난다 — 벌크 DELETE 로 둔다.
    @Modifying
    @Query("DELETE FROM CorrectionLikeJpaEntity cl WHERE cl.correctionId = :correctionId AND cl.userId = :userId")
    int deleteLike(@Param("correctionId") UUID correctionId, @Param("userId") UUID userId);

    @Query("""
            SELECT cl.correctionId, COUNT(cl)
            FROM CorrectionLikeJpaEntity cl
            WHERE cl.correctionId IN :ids
            GROUP BY cl.correctionId
            """)
    List<Object[]> countLikesByCorrectionIds(@Param("ids") List<UUID> ids);

    @Query("""
            SELECT cl.correctionId
            FROM CorrectionLikeJpaEntity cl
            WHERE cl.correctionId IN :ids AND cl.userId = :userId
            """)
    Set<UUID> findLikedCorrectionIds(@Param("ids") List<UUID> ids, @Param("userId") UUID userId);
}
