package me.yeonjae.tonebridge.adapter.out.persistence;

import jakarta.persistence.*;
import lombok.*;
import me.yeonjae.tonebridge.domain.user.FcmToken;
import me.yeonjae.tonebridge.domain.user.Platform;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "fcm_tokens")
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FcmTokenEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String token;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Platform platform;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (updatedAt == null) updatedAt = createdAt;
    }

    void updateToken(String newToken, Platform newPlatform) {
        this.token = newToken;
        this.platform = newPlatform;
        this.updatedAt = Instant.now();
    }

    public FcmToken toDomain() {
        return new FcmToken(id, userId, token, platform, createdAt, updatedAt);
    }

    public static FcmTokenEntity fromDomain(FcmToken t) {
        return FcmTokenEntity.builder()
                .id(t.id())
                .userId(t.userId())
                .token(t.token())
                .platform(t.platform())
                .createdAt(t.createdAt())
                .updatedAt(t.updatedAt())
                .build();
    }
}
