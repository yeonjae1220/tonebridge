package me.yeonjae.tonebridge.application.port.in;

import java.util.UUID;

public interface ValidateAudioKeyAccessUseCase {
    void validate(UUID userId, String audioKey);
}
