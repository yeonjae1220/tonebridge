package me.yeonjae.tonebridge.application.port.in;

import java.util.UUID;

public interface RemoveFriendUseCase {

    record Command(UUID requesterId, UUID friendId) {}

    /** Removes an existing friendship (accepted request) between the requester and friend. */
    void remove(Command command);
}
