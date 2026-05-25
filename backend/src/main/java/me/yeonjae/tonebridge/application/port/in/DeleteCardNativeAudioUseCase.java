package me.yeonjae.tonebridge.application.port.in;

import java.util.UUID;

public interface DeleteCardNativeAudioUseCase {
    void delete(UUID audioId, UUID cardId, UUID requesterId);
}
