package me.yeonjae.tonebridge.domain.friend;

import java.time.Instant;
import java.util.UUID;

public record FriendRequest(
        UUID id,
        UUID senderId,
        UUID receiverId,
        FriendStatus status,
        Instant createdAt,
        Instant updatedAt
) {
    public boolean isPending() {
        return status == FriendStatus.PENDING;
    }

    public boolean isAccepted() {
        return status == FriendStatus.ACCEPTED;
    }

    public FriendRequest accept() {
        if (!isPending()) {
            throw new IllegalStateException(
                    "Cannot accept a friend request that is not PENDING (current status: " + status + ")");
        }
        return new FriendRequest(id, senderId, receiverId, FriendStatus.ACCEPTED, createdAt, Instant.now());
    }
}
