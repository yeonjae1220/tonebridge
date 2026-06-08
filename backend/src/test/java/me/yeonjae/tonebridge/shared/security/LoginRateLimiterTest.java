package me.yeonjae.tonebridge.shared.security;

import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("LoginRateLimiter")
class LoginRateLimiterTest {

    @Mock private RedisTemplate<String, String> redisTemplate;
    @Mock private ValueOperations<String, String> valueOperations;

    @Test
    @DisplayName("checkLogin: IP와 정규화된 이메일 차원을 함께 제한한다")
    void checkLogin_hitsIpAndNormalizedEmailKeys() {
        LoginRateLimiter limiter = limiter();
        when(valueOperations.increment(anyString())).thenReturn(1L);

        limiter.checkLogin("203.0.113.7", " Alice@Example.com ");

        verify(valueOperations).increment("rl:login:ip:203.0.113.7");
        verify(valueOperations).increment("rl:login:email:alice@example.com");
    }

    @Test
    @DisplayName("checkLogin: 이메일 차원 한도를 넘으면 TOO_MANY_REQUESTS")
    void checkLogin_emailLimitExceededThrows() {
        LoginRateLimiter limiter = limiter();
        when(valueOperations.increment("rl:login:ip:203.0.113.7")).thenReturn(1L);
        when(valueOperations.increment("rl:login:email:alice@example.com")).thenReturn(11L);

        assertThatThrownBy(() -> limiter.checkLogin("203.0.113.7", "alice@example.com"))
                .isInstanceOf(ToneBridgeException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.TOO_MANY_REQUESTS);
    }

    @Test
    @DisplayName("checkRegister: IP와 정규화된 이메일 차원을 함께 제한한다")
    void checkRegister_hitsIpAndNormalizedEmailKeys() {
        LoginRateLimiter limiter = limiter();
        when(valueOperations.increment(anyString())).thenReturn(1L);

        limiter.checkRegister("203.0.113.7", " Alice@Example.com ");

        verify(valueOperations).increment("rl:register:ip:203.0.113.7");
        verify(valueOperations).increment("rl:register:email:alice@example.com");
    }

    @Test
    @DisplayName("checkRegister: 이메일 차원 한도를 넘으면 TOO_MANY_REQUESTS")
    void checkRegister_emailLimitExceededThrows() {
        LoginRateLimiter limiter = limiter();
        when(valueOperations.increment("rl:register:ip:203.0.113.7")).thenReturn(1L);
        when(valueOperations.increment("rl:register:email:alice@example.com")).thenReturn(6L);

        assertThatThrownBy(() -> limiter.checkRegister("203.0.113.7", "alice@example.com"))
                .isInstanceOf(ToneBridgeException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.TOO_MANY_REQUESTS);
    }

    private LoginRateLimiter limiter() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        return new LoginRateLimiter(redisTemplate);
    }
}
