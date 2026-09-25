package me.yeonjae.tonebridge.shared.security;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.yeonjae.tonebridge.shared.config.AuthRateLimitProperties;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 로컬 로그인/가입 brute-force 방어용 Redis 고정 윈도우 레이트 리미터.
 *
 * <p>두 가지를 지킨다.
 * <ul>
 *   <li>IP 차원은 클라이언트 IP 를 실제로 식별했을 때만 적용한다({@link ClientIpResolver}).
 *       모두가 같은 IP 로 보이면 임계값이 전체 로그인 차단 스위치가 되기 때문이다.</li>
 *   <li>로그인은 <b>실패만</b> 카운트한다. 성공까지 세면 정상 사용자가 남의 실패로 만들어진
 *       한도를 함께 소모한다.</li>
 * </ul>
 * 가입은 성공 자체가 남용이므로 시도마다 센다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LoginRateLimiter {

    private static final String LOGIN_IP_PREFIX = "rl:login:ip:";
    private static final String LOGIN_EMAIL_PREFIX = "rl:login:email:";
    private static final String REGISTER_IP_PREFIX = "rl:register:ip:";
    private static final String REGISTER_EMAIL_PREFIX = "rl:register:email:";

    private final RedisTemplate<String, String> redisTemplate;
    private final AuthRateLimitProperties properties;

    private final AtomicBoolean unknownIpWarned = new AtomicBoolean(false);

    /** 로그인 시도 전 한도 확인 — 카운터는 올리지 않는다. */
    public void checkLogin(Optional<String> clientIp, String email) {
        warnIfClientIpUnknown(clientIp);
        clientIp.ifPresent(ip -> ensureUnder(LOGIN_IP_PREFIX + ip, properties.getLoginPerIp()));
        ensureUnder(LOGIN_EMAIL_PREFIX + normalizeKeyPart(email), properties.getLoginPerEmail());
    }

    /** 로그인 실패 기록. */
    public void recordLoginFailure(Optional<String> clientIp, String email) {
        clientIp.ifPresent(ip -> increment(LOGIN_IP_PREFIX + ip));
        increment(LOGIN_EMAIL_PREFIX + normalizeKeyPart(email));
    }

    /** 가입 시도 제한: 시도마다 세고 그 자리에서 한도를 확인한다. */
    public void checkRegister(Optional<String> clientIp, String email) {
        warnIfClientIpUnknown(clientIp);
        clientIp.ifPresent(ip -> hit(REGISTER_IP_PREFIX + ip, properties.getRegisterPerIp()));
        hit(REGISTER_EMAIL_PREFIX + normalizeKeyPart(email), properties.getRegisterPerEmail());
    }

    private void warnIfClientIpUnknown(Optional<String> clientIp) {
        if (clientIp.isEmpty() && unknownIpWarned.compareAndSet(false, true)) {
            log.warn("클라이언트 IP 를 식별할 수 없어 IP 차원 레이트 리미트가 비활성입니다. "
                    + "프록시가 실제 IP 를 전달하도록 설정하면(ingress use-forwarded-headers 등) 자동으로 활성화됩니다.");
        }
    }

    private String normalizeKeyPart(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    /** 현재 카운터가 한도 이상이면 429. 카운터는 건드리지 않는다. */
    private void ensureUnder(String key, int max) {
        String raw;
        try {
            raw = redisTemplate.opsForValue().get(key);
        } catch (RuntimeException e) {
            // Redis 장애 시 인증 자체를 막지 않는다(fail-open) — 가용성 우선.
            log.warn("Rate limiter Redis 조회 실패, 제한 생략: key={}", key, e);
            return;
        }
        if (raw == null) {
            return;
        }
        long count;
        try {
            count = Long.parseLong(raw);
        } catch (NumberFormatException e) {
            log.warn("Rate limiter 카운터가 숫자가 아님, 제한 생략: key={}", key);
            return;
        }
        if (count >= max) {
            throw new ToneBridgeException(ErrorCode.TOO_MANY_REQUESTS);
        }
    }

    /** 카운터만 올린다(한도 확인은 다음 요청의 check 에서). */
    private void increment(String key) {
        try {
            Long count = redisTemplate.opsForValue().increment(key);
            if (count != null && count == 1L) {
                redisTemplate.expire(key, window());
            }
        } catch (RuntimeException e) {
            log.warn("Rate limiter Redis 기록 실패: key={}", key, e);
        }
    }

    /** 올리고 바로 한도를 확인한다(가입 경로). */
    private void hit(String key, int max) {
        Long count;
        try {
            count = redisTemplate.opsForValue().increment(key);
            if (count != null && count == 1L) {
                redisTemplate.expire(key, window());
            }
        } catch (RuntimeException e) {
            log.warn("Rate limiter Redis 접근 실패, 제한 생략: key={}", key, e);
            return;
        }
        if (count != null && count > max) {
            throw new ToneBridgeException(ErrorCode.TOO_MANY_REQUESTS);
        }
    }

    private Duration window() {
        return Duration.ofMinutes(properties.getWindowMinutes());
    }
}
