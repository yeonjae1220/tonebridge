package me.yeonjae.tonebridge.application.port.in;

import java.util.UUID;

public interface GetNativeAudioDownloadUrlUseCase {

    /** Returns a short-lived presigned download URL for the card's native audio. */
    String getDownloadUrl(UUID cardId, UUID requesterId);
}
