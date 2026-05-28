package me.yeonjae.tonebridge.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StudyCardJpaRepository extends JpaRepository<StudyCardEntity, UUID> {
    @Query("SELECT c FROM StudyCardEntity c WHERE c.id = :id AND c.deletedAt IS NULL")
    Optional<StudyCardEntity> findActiveById(@Param("id") UUID id);

    List<StudyCardEntity> findBySessionIdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID sessionId);
}
