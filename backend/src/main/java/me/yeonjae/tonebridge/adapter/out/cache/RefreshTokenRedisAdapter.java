package me.yeonjae.tonebridge.adapter.out.cache;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.RefreshTokenPort;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

/**
 * Redis에는 refresh token의 SHA-256 해시만 저장한다 — 평문 저장 시 Redis 유출 시
 * 즉시 세션 탈취로 이어지므로, 키/조회 모두 해시값 기준으로 수행한다.
 */
@Component
@RequiredArgsConstructor
public class RefreshTokenRedisAdapter implements RefreshTokenPort {

    private static final String TOKEN_PREFIX = "refresh:";
    private static final String USER_TOKENS_PREFIX = "user_tokens:";
    private final RedisTemplate<String, String> redisTemplate;

    @Override
    public void save(String refreshToken, UUID userId, long ttlSeconds) {
        String tokenHash = hash(refreshToken);
        String userKey = USER_TOKENS_PREFIX + userId;
        redisTemplate.opsForValue().set(TOKEN_PREFIX + tokenHash, userId.toString(), Duration.ofSeconds(ttlSeconds));
        redisTemplate.opsForSet().add(userKey, tokenHash);
        // Keep the set alive at least as long as any of its tokens.
        redisTemplate.expire(userKey, Duration.ofSeconds(ttlSeconds));
    }

    @Override
    public Optional<UUID> findUserIdByToken(String refreshToken) {
        String value = redisTemplate.opsForValue().get(TOKEN_PREFIX + hash(refreshToken));
        return Optional.ofNullable(value).map(UUID::fromString);
    }

    @Override
    public void delete(String refreshToken) {
        String tokenHash = hash(refreshToken);
        Optional<UUID> userId = findUserIdByToken(refreshToken);
        redisTemplate.delete(TOKEN_PREFIX + tokenHash);
        userId.ifPresent(id ->
                redisTemplate.opsForSet().remove(USER_TOKENS_PREFIX + id, tokenHash));
    }

    @Override
    public void deleteAllByUserId(UUID userId) {
        String userKey = USER_TOKENS_PREFIX + userId;
        var members = redisTemplate.opsForSet().members(userKey);
        if (members != null && !members.isEmpty()) {
            var tokenKeys = members.stream().map(tokenHash -> TOKEN_PREFIX + tokenHash).toList();
            redisTemplate.delete(tokenKeys);
        }
        redisTemplate.delete(userKey);
    }

    private String hash(String refreshToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(refreshToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256은 모든 JVM 구현에서 보장되는 알고리즘 — 발생 시 환경 자체가 손상된 것.
            throw new IllegalStateException("SHA-256 algorithm unavailable", e);
        }
    }
}
