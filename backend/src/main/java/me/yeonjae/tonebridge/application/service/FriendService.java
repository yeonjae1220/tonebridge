package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.in.AcceptFriendRequestUseCase;
import me.yeonjae.tonebridge.application.port.in.GetFriendsUseCase;
import me.yeonjae.tonebridge.application.port.in.SendFriendRequestUseCase;
import me.yeonjae.tonebridge.application.port.out.FriendPort;
import me.yeonjae.tonebridge.application.port.out.UserPort;
import me.yeonjae.tonebridge.domain.friend.FriendRequest;
import me.yeonjae.tonebridge.domain.friend.FriendStatus;
import me.yeonjae.tonebridge.domain.user.User;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
public class FriendService implements SendFriendRequestUseCase, AcceptFriendRequestUseCase, GetFriendsUseCase {

    private final FriendPort friendPort;
    private final UserPort userPort;

    @Override
    public FriendRequest send(SendFriendRequestUseCase.Command command) {
        User receiver = userPort.findByUsername(command.receiverUsername())
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.USER_NOT_FOUND));

        if (receiver.id().equals(command.senderId())) {
            throw new ToneBridgeException(ErrorCode.CANNOT_ADD_SELF);
        }

        // Check both directions to prevent duplicate requests from either side
        boolean alreadyExists =
                friendPort.findBySenderAndReceiver(command.senderId(), receiver.id()).isPresent() ||
                friendPort.findBySenderAndReceiver(receiver.id(), command.senderId()).isPresent();
        if (alreadyExists) {
            throw new ToneBridgeException(ErrorCode.FRIEND_REQUEST_ALREADY_SENT);
        }

        try {
            FriendRequest newRequest = new FriendRequest(
                    null, command.senderId(), receiver.id(), FriendStatus.PENDING, null, null);
            return friendPort.save(newRequest);
        } catch (DataIntegrityViolationException e) {
            // Race condition: concurrent request slipped past the guard
            throw new ToneBridgeException(ErrorCode.FRIEND_REQUEST_ALREADY_SENT);
        }
    }

    @Override
    public FriendRequest accept(AcceptFriendRequestUseCase.Command command) {
        FriendRequest request = friendPort.findById(command.requestId())
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.FRIEND_REQUEST_NOT_FOUND));

        if (!request.receiverId().equals(command.accepterId())) {
            throw new ToneBridgeException(ErrorCode.NOT_FRIEND_REQUEST_RECEIVER);
        }

        return friendPort.save(request.accept());
    }

    @Override
    @Transactional(readOnly = true)
    public List<User> getFriends(UUID userId) {
        List<FriendRequest> accepted = friendPort.findAcceptedByUserId(userId);
        Set<UUID> friendIds = accepted.stream()
                .map(r -> r.senderId().equals(userId) ? r.receiverId() : r.senderId())
                .collect(Collectors.toSet());
        return userPort.findAllByIds(friendIds);
    }

    @Override
    @Transactional(readOnly = true)
    public List<GetFriendsUseCase.PendingRequestView> getPendingRequests(UUID userId) {
        List<FriendRequest> pending = friendPort.findPendingByReceiverId(userId);
        if (pending.isEmpty()) return List.of();
        Set<UUID> senderIds = pending.stream().map(FriendRequest::senderId).collect(Collectors.toSet());
        Map<UUID, String> usernameMap = userPort.findAllByIds(senderIds).stream()
                .collect(Collectors.toMap(User::id, User::username));
        return pending.stream()
                .map(r -> new GetFriendsUseCase.PendingRequestView(r,
                        usernameMap.getOrDefault(r.senderId(), "알 수 없음")))
                .toList();
    }
}
