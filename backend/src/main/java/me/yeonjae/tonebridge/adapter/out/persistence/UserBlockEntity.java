package me.yeonjae.tonebridge.adapter.out.persistence;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name="user_blocks")
public class UserBlockEntity {
    @Id private UUID id;
    @Column(name="blocker_id", nullable=false) private UUID blockerId;
    @Column(name="blocked_id", nullable=false) private UUID blockedId;
    protected UserBlockEntity() {}
}
