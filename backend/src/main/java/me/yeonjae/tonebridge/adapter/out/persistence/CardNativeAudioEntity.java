package me.yeonjae.tonebridge.adapter.out.persistence;

import jakarta.persistence.*;
import lombok.*;
import me.yeonjae.tonebridge.domain.studycard.CardNativeAudio;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "card_native_audio")
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CardNativeAudioEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID cardId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String audioKey;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(columnDefinition = "TEXT")
    private String note;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }

    public CardNativeAudio toDomain() {
        return new CardNativeAudio(id, cardId, audioKey, createdAt, note);
    }

    public static CardNativeAudioEntity fromDomain(CardNativeAudio a) {
        return CardNativeAudioEntity.builder()
                .id(a.id())
                .cardId(a.cardId())
                .audioKey(a.audioKey())
                .createdAt(a.createdAt())
                .note(a.note())
                .build();
    }
}
