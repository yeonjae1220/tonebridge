package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.user.User;

import java.util.UUID;

public interface GetCurrentUserUseCase {
    User get(UUID userId);
}
