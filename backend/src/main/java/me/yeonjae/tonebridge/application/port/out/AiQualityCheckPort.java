package me.yeonjae.tonebridge.application.port.out;

import java.util.UUID;

public interface AiQualityCheckPort {
    void checkQualityAsync(UUID correctionId, UUID correctorId, UUID requesterId,
                           String original, String corrected, String explanation, int reward, boolean isAudio);
}
