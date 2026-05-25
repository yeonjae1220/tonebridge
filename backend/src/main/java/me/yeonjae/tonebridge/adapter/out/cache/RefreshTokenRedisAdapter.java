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

    private static final String TOKEN_PREFIX = "refresh:";
    private static final String USER_TOKENS_PREFIX = "user_tokens:";
    private final RedisTemplate<String, String> redisTemplate;

    @Override
    public void save(String refreshToken, UUID userId, long ttlSeconds) {
        String tokenKey = TOKEN_PREFIX + refreshToken;
        String userKey = USER_TOKENS_PREFIX + userId;
        redisTemplate.opsForValue().set(tokenKey, userId.toString(), Duration.ofSeconds(ttlSeconds));
        redisTemplate.opsForSet().add(userKey, refreshToken);
        // Keep the set alive at least as long as any of its tokens.
        redisTemplate.expire(userKey, Duration.ofSeconds(ttlSeconds));
    }

    @Override
    public Optional<UUID> findUserIdByToken(String refreshToken) {
        String value = redisTemplate.opsForValue().get(TOKEN_PREFIX + refreshToken);
        return Optional.ofNullable(value).map(UUID::fromString);
    }

    @Override
    public void delete(String refreshToken) {
        Optional<UUID> userId = findUserIdByToken(refreshToken);
        redisTemplate.delete(TOKEN_PREFIX + refreshToken);
        userId.ifPresent(id ->
                redisTemplate.opsForSet().remove(USER_TOKENS_PREFIX + id, refreshToken));
    }

    @Override
    public void deleteAllByUserId(UUID userId) {
        String userKey = USER_TOKENS_PREFIX + userId;
        var members = redisTemplate.opsForSet().members(userKey);
        if (members != null && !members.isEmpty()) {
            var tokenKeys = members.stream().map(t -> TOKEN_PREFIX + t).toList();
            redisTemplate.delete(tokenKeys);
        }
        redisTemplate.delete(userKey);
    }
}
