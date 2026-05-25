package me.yeonjae.tonebridge.adapter.in.web.dto;

import me.yeonjae.tonebridge.domain.studycard.CardNativeAudio;

import java.time.Instant;
import java.util.UUID;

public record CardNativeAudioResponse(
        UUID id,
        UUID cardId,
        Instant createdAt
) {
    public static CardNativeAudioResponse from(CardNativeAudio a) {
        return new CardNativeAudioResponse(a.id(), a.cardId(), a.createdAt());
    }
}
