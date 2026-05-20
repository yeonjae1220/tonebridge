package me.yeonjae.tonebridge.application.port.in;

import java.util.UUID;

public interface DeclineFriendRequestUseCase {

    record Command(UUID requestId, UUID declinerId) {}

    /** Declines (and deletes) a pending friend request. Only the receiver may decline. */
    void decline(Command command);
}
