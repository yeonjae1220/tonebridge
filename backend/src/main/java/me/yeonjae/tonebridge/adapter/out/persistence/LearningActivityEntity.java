package me.yeonjae.tonebridge.adapter.out.persistence;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.yeonjae.tonebridge.shared.event.LearningActivity;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "learning_activity")
@Getter
@NoArgsConstructor
public class LearningActivityEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 32) private LearningActivity.Kind kind;
    @Column(nullable = false) private UUID actorId;
    private UUID peerId;
    private UUID sessionId;
    private UUID cardId;
    private UUID attemptId;
    @Column(nullable = false) private Instant occurredAt;

    public LearningActivityEntity(LearningActivity event) {
        kind = event.kind(); actorId = event.actorId(); peerId = event.peerId();
        sessionId = event.sessionId(); cardId = event.cardId(); attemptId = event.attemptId();
        occurredAt = Instant.now();
    }
}
