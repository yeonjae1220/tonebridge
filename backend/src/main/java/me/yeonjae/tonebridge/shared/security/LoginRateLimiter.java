package me.yeonjae.tonebridge.shared.security;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Locale;

/**
 * 로컬 로그인/회원가입 brute-force 방어용 Redis 고정 윈도우 레이트 리미터.
 *
 * <p>IP 차원과 이메일 차원을 각각 카운트한다 — IP 스푸핑(X-Real-IP)으로 IP 키를
 * 우회하더라도 이메일 차원 제한이 특정 계정에 대한 대량 시도를 막는다.
 * 임계 초과 시 {@link ErrorCode#TOO_MANY_REQUESTS}(429)를 던진다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LoginRateLimiter {

    private static final String LOGIN_IP_PREFIX = "rl:login:ip:";
    private static final String LOGIN_EMAIL_PREFIX = "rl:login:email:";
    private static final String REGISTER_IP_PREFIX = "rl:register:ip:";
    private static final String REGISTER_EMAIL_PREFIX = "rl:register:email:";

    private static final int LOGIN_MAX_PER_WINDOW = 10;
    private static final int REGISTER_MAX_PER_WINDOW = 5;
    private static final Duration WINDOW = Duration.ofMinutes(15);

    private final RedisTemplate<String, String> redisTemplate;

    /** 로그인 시도 제한: IP 차원 + 이메일 차원 동시 검사. */
    public void checkLogin(String ip, String email) {
        hit(LOGIN_IP_PREFIX + ip, LOGIN_MAX_PER_WINDOW);
        hit(LOGIN_EMAIL_PREFIX + normalizeKeyPart(email), LOGIN_MAX_PER_WINDOW);
    }

    /** 회원가입 시도 제한: IP 차원 + 이메일 차원 동시 검사. */
    public void checkRegister(String ip, String email) {
        hit(REGISTER_IP_PREFIX + ip, REGISTER_MAX_PER_WINDOW);
        hit(REGISTER_EMAIL_PREFIX + normalizeKeyPart(email), REGISTER_MAX_PER_WINDOW);
    }

    private String normalizeKeyPart(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private void hit(String key, int max) {
        Long count;
        try {
            count = redisTemplate.opsForValue().increment(key);
            if (count != null && count == 1L) {
                redisTemplate.expire(key, WINDOW);
            }
        } catch (RuntimeException e) {
            // Redis 장애 시 인증 자체를 막지 않는다(fail-open) — 가용성 우선.
            log.warn("Rate limiter Redis 접근 실패, 제한 생략: key={}", key, e);
            return;
        }
        if (count != null && count > max) {
            throw new ToneBridgeException(ErrorCode.TOO_MANY_REQUESTS);
        }
    }
}
