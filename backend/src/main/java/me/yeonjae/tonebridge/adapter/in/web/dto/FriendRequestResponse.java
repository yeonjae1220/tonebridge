package me.yeonjae.tonebridge.adapter.in.web.dto;

import me.yeonjae.tonebridge.application.port.in.GetFriendsUseCase;
import me.yeonjae.tonebridge.domain.friend.FriendRequest;

import java.time.Instant;
import java.util.UUID;

public record FriendRequestResponse(
        UUID id,
        UUID senderId,
        UUID receiverId,
        String status,
        String senderUsername,
        Instant createdAt
) {
    public static FriendRequestResponse from(FriendRequest r) {
        return new FriendRequestResponse(r.id(), r.senderId(), r.receiverId(),
                r.status().name(), null, r.createdAt());
    }

    public static FriendRequestResponse fromPending(GetFriendsUseCase.PendingRequestView view) {
        FriendRequest r = view.request();
        return new FriendRequestResponse(r.id(), r.senderId(), r.receiverId(),
                r.status().name(), view.senderUsername(), r.createdAt());
    }
}
