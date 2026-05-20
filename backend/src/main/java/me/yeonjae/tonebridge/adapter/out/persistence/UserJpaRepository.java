package me.yeonjae.tonebridge.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface UserJpaRepository extends JpaRepository<UserEntity, UUID> {
    Optional<UserEntity> findByEmail(String email);
    Optional<UserEntity> findByUsername(String username);

    @Modifying
    @Query("UPDATE UserEntity u SET u.credits = u.credits + :delta WHERE u.id = :userId AND (u.credits + :delta) >= 0")
    int adjustCredits(UUID userId, int delta);
}
