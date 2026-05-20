package me.yeonjae.tonebridge.adapter.out.persistence;

import jakarta.persistence.*;
import lombok.*;
import me.yeonjae.tonebridge.domain.friend.FriendRequest;
import me.yeonjae.tonebridge.domain.friend.FriendStatus;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "friend_requests")
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FriendRequestEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID senderId;

    @Column(nullable = false)
    private UUID receiverId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FriendStatus status;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (updatedAt == null) updatedAt = createdAt;
        if (status == null) status = FriendStatus.PENDING;
    }

    public FriendRequest toDomain() {
        return new FriendRequest(id, senderId, receiverId, status, createdAt, updatedAt);
    }

    public static FriendRequestEntity fromDomain(FriendRequest r) {
        return FriendRequestEntity.builder()
                .id(r.id())
                .senderId(r.senderId())
                .receiverId(r.receiverId())
                .status(r.status())
                .createdAt(r.createdAt())
                .updatedAt(r.updatedAt())
                .build();
    }
}
