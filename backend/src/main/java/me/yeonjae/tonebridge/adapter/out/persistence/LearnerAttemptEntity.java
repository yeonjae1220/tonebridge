package me.yeonjae.tonebridge.adapter.out.persistence;

import jakarta.persistence.*;
import lombok.*;
import me.yeonjae.tonebridge.domain.studycard.LearnerAttempt;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "learner_attempts")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LearnerAttemptEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID cardId;

    @Column(nullable = false)
    private UUID learnerId;

    @Column(nullable = false, length = 500)
    private String audioUrl;

    @Column(columnDefinition = "TEXT")
    private String correctionNote;

    private Integer score;

    @Column(nullable = false, updatable = false)
    private Instant attemptedAt;

    @PrePersist
    void prePersist() {
        if (attemptedAt == null) attemptedAt = Instant.now();
    }

    public LearnerAttempt toDomain() {
        return new LearnerAttempt(id, cardId, learnerId, audioUrl, correctionNote, score, attemptedAt);
    }

    public static LearnerAttemptEntity fromDomain(LearnerAttempt a) {
        return LearnerAttemptEntity.builder()
                .id(a.id())
                .cardId(a.cardId())
                .learnerId(a.learnerId())
                .audioUrl(a.audioUrl())
                .correctionNote(a.correctionNote())
                .score(a.score())
                .attemptedAt(a.attemptedAt())
                .build();
    }
}
