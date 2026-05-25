package me.yeonjae.tonebridge.application.port.in;

import java.util.UUID;

public interface DeleteCurrentUserUseCase {
    void delete(UUID userId);
}
