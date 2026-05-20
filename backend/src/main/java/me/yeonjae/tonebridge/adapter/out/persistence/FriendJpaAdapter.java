package me.yeonjae.tonebridge.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.FriendPort;
import me.yeonjae.tonebridge.domain.friend.FriendRequest;
import me.yeonjae.tonebridge.domain.friend.FriendStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Transactional
public class FriendJpaAdapter implements FriendPort {

    private final FriendRequestJpaRepository repository;

    @Override
    public FriendRequest save(FriendRequest request) {
        return repository.save(FriendRequestEntity.fromDomain(request)).toDomain();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<FriendRequest> findById(UUID id) {
        return repository.findById(id).map(FriendRequestEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<FriendRequest> findAcceptedByUserId(UUID userId) {
        return repository.findByUserIdAndStatus(userId, FriendStatus.ACCEPTED)
                .stream().map(FriendRequestEntity::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<FriendRequest> findPendingByReceiverId(UUID receiverId) {
        return repository.findByReceiverIdAndStatus(receiverId, FriendStatus.PENDING)
                .stream().map(FriendRequestEntity::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<FriendRequest> findBySenderAndReceiver(UUID senderId, UUID receiverId) {
        return repository.findBySenderIdAndReceiverId(senderId, receiverId)
                .map(FriendRequestEntity::toDomain);
    }

    @Override
    public void deleteById(UUID id) {
        repository.deleteById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<FriendRequest> findAcceptedBetween(UUID userId1, UUID userId2) {
        return repository.findAcceptedBetween(userId1, userId2)
                .map(FriendRequestEntity::toDomain);
    }
}
