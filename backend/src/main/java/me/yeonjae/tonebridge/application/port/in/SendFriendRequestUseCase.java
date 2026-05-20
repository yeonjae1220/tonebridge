package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.friend.FriendRequest;

import java.util.UUID;

public interface SendFriendRequestUseCase {
    record Command(UUID senderId, String receiverUsername) {}

    FriendRequest send(Command command);
}
