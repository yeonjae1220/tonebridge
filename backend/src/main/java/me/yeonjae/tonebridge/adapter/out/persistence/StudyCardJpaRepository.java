package me.yeonjae.tonebridge.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface StudyCardJpaRepository extends JpaRepository<StudyCardEntity, UUID> {
    List<StudyCardEntity> findBySessionIdOrderByCreatedAtDesc(UUID sessionId);
}
