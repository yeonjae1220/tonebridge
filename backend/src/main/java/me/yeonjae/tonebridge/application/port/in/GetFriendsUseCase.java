package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.friend.FriendRequest;
import me.yeonjae.tonebridge.domain.user.User;

import java.util.List;
import java.util.UUID;

public interface GetFriendsUseCase {
    List<User> getFriends(UUID userId);
    List<PendingRequestView> getPendingRequests(UUID userId);

    record PendingRequestView(FriendRequest request, String senderUsername) {}
}
