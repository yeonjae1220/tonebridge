package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.friend.FriendRequest;
import me.yeonjae.tonebridge.domain.user.User;

import java.util.List;
import java.util.UUID;

public interface GetFriendsUseCase {
    record SentRequestView(UUID id, UUID receiverId, String receiverUsername, java.time.Instant createdAt) {}
    record SentRequestPage(List<SentRequestView> items, Integer nextPage) {}
    SentRequestPage getSentRequests(UUID userId, int page);
    List<User> getFriends(UUID userId);
    List<PendingRequestView> getPendingRequests(UUID userId);

    record PendingRequestView(FriendRequest request, String senderUsername) {}
}
