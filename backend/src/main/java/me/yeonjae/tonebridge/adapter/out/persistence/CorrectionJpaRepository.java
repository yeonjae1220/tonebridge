package me.yeonjae.tonebridge.adapter.out.persistence;

import me.yeonjae.tonebridge.domain.correction.CorrectionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CorrectionJpaRepository extends JpaRepository<CorrectionEntity, UUID> {
    Optional<CorrectionEntity> findByReferenceAudioUrl(String referenceAudioUrl);

    List<CorrectionEntity> findByRequestIdOrderByCreatedAtAsc(UUID requestId);

    @Modifying
    @Query("UPDATE CorrectionEntity c SET c.status = :status WHERE c.id = :id")
    void updateStatus(@Param("id") UUID id, @Param("status") CorrectionStatus status);
}
