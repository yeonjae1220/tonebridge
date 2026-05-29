package me.yeonjae.tonebridge.adapter.out.persistence;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
    name = "correction_likes",
    uniqueConstraints = @UniqueConstraint(name = "uq_correction_like", columnNames = {"correction_id", "user_id"})
)
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CorrectionLikeJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "correction_id", nullable = false)
    private UUID correctionId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
