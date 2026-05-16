package me.yeonjae.tonebridge.adapter.out.cache;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.RefreshTokenPort;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class RefreshTokenRedisAdapter implements RefreshTokenPort {

    private static final String PREFIX = "refresh:";
    private final RedisTemplate<String, String> redisTemplate;

    @Override
    public void save(String refreshToken, UUID userId, long ttlSeconds) {
        redisTemplate.opsForValue().set(PREFIX + refreshToken, userId.toString(), Duration.ofSeconds(ttlSeconds));
    }

    @Override
    public Optional<UUID> findUserIdByToken(String refreshToken) {
        String value = redisTemplate.opsForValue().get(PREFIX + refreshToken);
        return Optional.ofNullable(value).map(UUID::fromString);
    }

    @Override
    public void delete(String refreshToken) {
        redisTemplate.delete(PREFIX + refreshToken);
    }
}
