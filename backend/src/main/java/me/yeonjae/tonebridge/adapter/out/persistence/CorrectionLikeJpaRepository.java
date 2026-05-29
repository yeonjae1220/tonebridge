package me.yeonjae.tonebridge.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Set;
import java.util.UUID;

public interface CorrectionLikeJpaRepository extends JpaRepository<CorrectionLikeJpaEntity, UUID> {

    boolean existsByCorrectionIdAndUserId(UUID correctionId, UUID userId);

    int deleteByCorrectionIdAndUserId(UUID correctionId, UUID userId);

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
