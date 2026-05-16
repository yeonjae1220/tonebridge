package me.yeonjae.tonebridge.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface RatingJpaRepository extends JpaRepository<RatingEntity, UUID> {
    boolean existsByCorrectionId(UUID correctionId);
}
