package me.yeonjae.tonebridge.adapter.out.cache;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.OAuthStatePort;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class OAuthStateRedisAdapter implements OAuthStatePort {

    private static final String PREFIX = "oauth_state:";
    private static final Duration TTL = Duration.ofSeconds(300);

    private final StringRedisTemplate redisTemplate;

    @Override
    public String generateAndSave() {
        String state = UUID.randomUUID().toString();
        redisTemplate.opsForValue().set(PREFIX + state, "1", TTL);
        return state;
    }

    @Override
    public boolean validateAndConsume(String state) {
        String key = PREFIX + state;
        Boolean deleted = redisTemplate.delete(key);
        return Boolean.TRUE.equals(deleted);
    }
}
