package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.friend.FriendRequest;

import java.util.UUID;

public interface AcceptFriendRequestUseCase {
    record Command(UUID requestId, UUID accepterId) {}

    FriendRequest accept(Command command);
}
