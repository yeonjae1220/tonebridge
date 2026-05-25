package me.yeonjae.tonebridge.application.port.in;

import java.util.UUID;

public interface UpdateNicknameUseCase {
    record Command(UUID userId, String username) {}

    void update(Command command);
}
