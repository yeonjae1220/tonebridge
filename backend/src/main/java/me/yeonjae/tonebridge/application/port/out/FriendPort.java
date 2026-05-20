package me.yeonjae.tonebridge.application.port.out;

import me.yeonjae.tonebridge.domain.friend.FriendRequest;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FriendPort {
    FriendRequest save(FriendRequest request);
    Optional<FriendRequest> findById(UUID id);
    List<FriendRequest> findAcceptedByUserId(UUID userId);
    List<FriendRequest> findPendingByReceiverId(UUID receiverId);
    Optional<FriendRequest> findBySenderAndReceiver(UUID senderId, UUID receiverId);
}
