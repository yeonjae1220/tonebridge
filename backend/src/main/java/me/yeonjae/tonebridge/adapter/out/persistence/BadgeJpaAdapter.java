package me.yeonjae.tonebridge.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.BadgePort;
import me.yeonjae.tonebridge.domain.user.BadgeType;
import me.yeonjae.tonebridge.domain.user.UserBadge;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Transactional
public class BadgeJpaAdapter implements BadgePort {

    private final BadgeJpaRepository repository;

    @Override
    @Transactional(readOnly = true)
    public boolean exists(UUID userId, BadgeType badgeType) {
        return repository.existsByUserIdAndBadgeType(userId, badgeType);
    }

    @Override
    public UserBadge save(UserBadge badge) {
        return repository.save(BadgeEntity.fromDomain(badge)).toDomain();
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserBadge> findByUserId(UUID userId) {
        return repository.findByUserId(userId).stream()
                .map(BadgeEntity::toDomain)
                .toList();
    }
}
