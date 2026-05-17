package me.yeonjae.tonebridge.application.port.out;

import me.yeonjae.tonebridge.domain.user.BadgeType;
import me.yeonjae.tonebridge.domain.user.UserBadge;

import java.util.List;
import java.util.UUID;

public interface BadgePort {
    boolean exists(UUID userId, BadgeType badgeType);
    UserBadge save(UserBadge badge);
    List<UserBadge> findByUserId(UUID userId);
}
