package me.yeonjae.tonebridge.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface FcmTokenJpaRepository extends JpaRepository<FcmTokenEntity, UUID> {
    Optional<FcmTokenEntity> findByUserId(UUID userId);
    void deleteByToken(String token);
}
