package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.user.Platform;

import java.util.UUID;

public interface RegisterFcmTokenUseCase {

    void register(Command command);

    record Command(UUID userId, String token, Platform platform) {}
}
