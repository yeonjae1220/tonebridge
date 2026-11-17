package me.yeonjae.tonebridge.adapter.out.persistence;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserJpaRepository extends JpaRepository<UserEntity, UUID> {
    Optional<UserEntity> findByEmail(String email);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM UserEntity u WHERE u.email = :email")
    Optional<UserEntity> findByEmailForUpdate(String email);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM UserEntity u WHERE u.id = :id")
    Optional<UserEntity> findByIdForUpdate(UUID id);

    @Query("SELECT u.credentialsVersion FROM UserEntity u WHERE u.id = :id")
    Optional<Long> credentialsVersion(UUID id);
    Optional<UserEntity> findByUsername(String username);
    boolean existsByEmail(String email);
    boolean existsByUsername(String username);
    List<UserEntity> findByUsernameStartingWithIgnoreCase(String prefix, Pageable pageable);

    @Query("""
        SELECT u FROM UserEntity u WHERE u.id <> :viewerId
        AND LOWER(SUBSTRING(u.username,1,LENGTH(:prefix))) = LOWER(:prefix)
        AND NOT EXISTS (SELECT b.id FROM UserBlockEntity b
            WHERE (b.blockerId = :viewerId AND b.blockedId = u.id)
               OR (b.blockedId = :viewerId AND b.blockerId = u.id))
        ORDER BY u.username,u.id
        """)
    List<UserEntity> searchVisible(String prefix, UUID viewerId, Pageable pageable);

    @Modifying
    @Query("UPDATE UserEntity u SET u.credits = u.credits + :delta WHERE u.id = :userId AND (u.credits + :delta) >= 0")
    int adjustCredits(UUID userId, int delta);
}
