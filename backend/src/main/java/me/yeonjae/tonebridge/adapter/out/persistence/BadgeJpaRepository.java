package me.yeonjae.tonebridge.adapter.out.persistence;

import me.yeonjae.tonebridge.domain.user.BadgeType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BadgeJpaRepository extends JpaRepository<BadgeEntity, UUID> {
    boolean existsByUserIdAndBadgeType(UUID userId, BadgeType badgeType);
    List<BadgeEntity> findByUserId(UUID userId);
}
