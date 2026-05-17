package me.yeonjae.tonebridge.adapter.out.persistence;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface RatingJpaRepository extends JpaRepository<RatingEntity, UUID> {
    boolean existsByCorrectionId(UUID correctionId);

    @Query("""
            SELECT r FROM RatingEntity r
            WHERE r.correctionId IN (
                SELECT c.id FROM CorrectionEntity c
                WHERE c.correctorId = :correctorId AND c.isAi = false
            )
            ORDER BY r.createdAt DESC
            """)
    List<RatingEntity> findRecentByCorrectorId(@Param("correctorId") UUID correctorId, Pageable pageable);
}
