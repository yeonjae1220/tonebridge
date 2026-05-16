package me.yeonjae.tonebridge.application.port.out;

import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenPort {
    void save(String refreshToken, UUID userId, long ttlSeconds);
    Optional<UUID> findUserIdByToken(String refreshToken);
    void delete(String refreshToken);
}
