package me.yeonjae.tonebridge.adapter.out.persistence;

import jakarta.persistence.*;
import lombok.*;
import me.yeonjae.tonebridge.domain.user.BadgeType;
import me.yeonjae.tonebridge.domain.user.UserBadge;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_badges")
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BadgeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BadgeType badgeType;

    @Column(nullable = false, updatable = false)
    private Instant awardedAt;

    @PrePersist
    void prePersist() {
        if (awardedAt == null) awardedAt = Instant.now();
    }

    public UserBadge toDomain() {
        return new UserBadge(id, userId, badgeType, awardedAt);
    }

    public static BadgeEntity fromDomain(UserBadge badge) {
        return BadgeEntity.builder()
                .id(badge.id())
                .userId(badge.userId())
                .badgeType(badge.badgeType())
                .awardedAt(badge.awardedAt())
                .build();
    }
}
