package me.yeonjae.tonebridge.adapter.out.persistence;

import me.yeonjae.tonebridge.domain.friend.FriendStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FriendRequestJpaRepository extends JpaRepository<FriendRequestEntity, UUID> {

    @Query("""
            SELECT f FROM FriendRequestEntity f
            WHERE (f.senderId = :userId OR f.receiverId = :userId)
              AND f.status = :status
            """)
    List<FriendRequestEntity> findByUserIdAndStatus(UUID userId, FriendStatus status);

    List<FriendRequestEntity> findByReceiverIdAndStatus(UUID receiverId, FriendStatus status);

    Optional<FriendRequestEntity> findBySenderIdAndReceiverId(UUID senderId, UUID receiverId);

    @Query("""
            SELECT f FROM FriendRequestEntity f
            WHERE (f.senderId = :userId1 AND f.receiverId = :userId2
                OR f.senderId = :userId2 AND f.receiverId = :userId1)
              AND f.status = 'ACCEPTED'
            """)
    Optional<FriendRequestEntity> findAcceptedBetween(UUID userId1, UUID userId2);
}
