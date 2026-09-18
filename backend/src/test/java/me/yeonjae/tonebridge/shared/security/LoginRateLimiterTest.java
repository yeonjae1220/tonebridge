package me.yeonjae.tonebridge.shared.security;

import me.yeonjae.tonebridge.shared.config.AuthRateLimitProperties;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("LoginRateLimiter")
class LoginRateLimiterTest {

    @Mock private RedisTemplate<String, String> redisTemplate;
    @Mock private ValueOperations<String, String> valueOperations;

    private final AuthRateLimitProperties properties = new AuthRateLimitProperties();

    @Test
    @DisplayName("checkLogin: 확인 단계에서는 카운터를 올리지 않는다")
    void checkLogin_readsCountersWithoutIncrementing() {
        LoginRateLimiter limiter = limiter();
        when(valueOperations.get(anyString())).thenReturn(null);

        limiter.checkLogin(Optional.of("203.0.113.7"), " Alice@Example.com ");

        verify(valueOperations).get("rl:login:ip:203.0.113.7");
        verify(valueOperations).get("rl:login:email:alice@example.com");
        verify(valueOperations, never()).increment(anyString());
    }

    @Test
    @DisplayName("checkLogin: 이메일 차원 한도에 도달하면 TOO_MANY_REQUESTS")
    void checkLogin_emailLimitReachedThrows() {
        LoginRateLimiter limiter = limiter();
        when(valueOperations.get("rl:login:ip:203.0.113.7")).thenReturn("0");
        when(valueOperations.get("rl:login:email:alice@example.com")).thenReturn("10");

        assertThatThrownBy(() -> limiter.checkLogin(Optional.of("203.0.113.7"), "alice@example.com"))
                .isInstanceOf(ToneBridgeException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.TOO_MANY_REQUESTS);
    }

    @Test
    @DisplayName("클라이언트 IP 를 모르면 IP 차원을 건너뛴다 — 공용 IP 가 전체 로그인 차단 스위치가 되지 않도록")
    void checkLogin_skipsIpDimensionWhenClientIpUnknown() {
        LoginRateLimiter limiter = limiter();
        when(valueOperations.get("rl:login:email:alice@example.com")).thenReturn("99");

        // 이메일 카운터가 한도를 넘었으므로 그건 그대로 막히고, IP 키는 아예 조회되지 않아야 한다.
        assertThatThrownBy(() -> limiter.checkLogin(Optional.empty(), "alice@example.com"))
                .isInstanceOf(ToneBridgeException.class);

        verify(valueOperations, never()).get(startsWith("rl:login:ip:"));
    }

    @Test
    @DisplayName("recordLoginFailure: 실패했을 때만 두 차원을 올린다")
    void recordLoginFailure_incrementsBothDimensions() {
        LoginRateLimiter limiter = limiterWithoutValueOpsStub();
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment(anyString())).thenReturn(1L);

        limiter.recordLoginFailure(Optional.of("203.0.113.7"), "Alice@Example.com");

        verify(valueOperations).increment("rl:login:ip:203.0.113.7");
        verify(valueOperations).increment("rl:login:email:alice@example.com");
        verify(redisTemplate, times(2)).expire(anyString(), any(Duration.class));
    }

    @Test
    @DisplayName("checkRegister: 가입은 시도마다 세고 한도를 넘으면 TOO_MANY_REQUESTS")
    void checkRegister_limitExceededThrows() {
        LoginRateLimiter limiter = limiter();
        when(valueOperations.increment("rl:register:ip:203.0.113.7")).thenReturn(1L);
        when(valueOperations.increment("rl:register:email:alice@example.com")).thenReturn(6L);

        assertThatThrownBy(() -> limiter.checkRegister(Optional.of("203.0.113.7"), "alice@example.com"))
                .isInstanceOf(ToneBridgeException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.TOO_MANY_REQUESTS);
    }

    @Test
    @DisplayName("Redis 장애 시에는 제한을 생략하고 인증을 막지 않는다")
    void checkLogin_failsOpenWhenRedisIsDown() {
        LoginRateLimiter limiter = limiter();
        when(valueOperations.get(anyString())).thenThrow(new IllegalStateException("redis down"));

        assertThatCode(() -> limiter.checkLogin(Optional.of("203.0.113.7"), "alice@example.com"))
                .doesNotThrowAnyException();
    }

    private LoginRateLimiter limiter() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        return new LoginRateLimiter(redisTemplate, properties);
    }

    private LoginRateLimiter limiterWithoutValueOpsStub() {
        return new LoginRateLimiter(redisTemplate, properties);
    }
}
