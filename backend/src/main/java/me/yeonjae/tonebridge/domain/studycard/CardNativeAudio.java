package me.yeonjae.tonebridge.domain.studycard;

import java.time.Instant;
import java.util.UUID;

public record CardNativeAudio(
        UUID id,
        UUID cardId,
        String audioKey,
        Instant createdAt,
        String note
) {
    public CardNativeAudio withNote(String newNote) {
        return new CardNativeAudio(id, cardId, audioKey, createdAt, newNote);
    }
}
