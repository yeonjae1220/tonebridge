package me.yeonjae.tonebridge.application.port.out;

import me.yeonjae.tonebridge.domain.user.FcmToken;

import java.util.Optional;
import java.util.UUID;

public interface FcmTokenPort {
    void saveOrUpdate(FcmToken token);
    Optional<FcmToken> findByUserId(UUID userId);
    void deleteByToken(String token);
}
