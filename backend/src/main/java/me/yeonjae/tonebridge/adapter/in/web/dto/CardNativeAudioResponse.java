package me.yeonjae.tonebridge.adapter.in.web.dto;

import me.yeonjae.tonebridge.domain.studycard.CardNativeAudio;

import java.time.Instant;
import java.util.UUID;

/**
 * {@code mine} is true when the requester recorded this audio. Any notebook member can add
 * example audio, so the card author is not a reliable stand-in for who recorded it.
 */
public record CardNativeAudioResponse(
        UUID id,
        UUID cardId,
        Instant createdAt,
        String note,
        boolean mine
) {
    public static CardNativeAudioResponse from(CardNativeAudio a, boolean mine) {
        return new CardNativeAudioResponse(a.id(), a.cardId(), a.createdAt(), a.note(), mine);
    }
}
