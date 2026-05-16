package me.yeonjae.tonebridge.adapter.out.persistence;

import jakarta.persistence.*;
import lombok.*;
import me.yeonjae.tonebridge.domain.correction.Rating;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ratings")
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RatingEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private UUID correctionId;

    @Column(nullable = false)
    private UUID raterId;

    @Column(nullable = false)
    private boolean helpful;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }

    public Rating toDomain() {
        return new Rating(id, correctionId, raterId, helpful, createdAt);
    }

    public static RatingEntity fromDomain(Rating r) {
        return RatingEntity.builder()
                .id(r.id())
                .correctionId(r.correctionId())
                .raterId(r.raterId())
                .helpful(r.helpful())
                .createdAt(r.createdAt())
                .build();
    }
}
