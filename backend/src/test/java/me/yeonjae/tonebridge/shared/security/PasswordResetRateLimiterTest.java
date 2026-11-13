package me.yeonjae.tonebridge.shared.security;
import me.yeonjae.tonebridge.shared.config.PasswordResetProperties;
import me.yeonjae.tonebridge.shared.exception.*;
import org.junit.jupiter.api.*;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.testcontainers.containers.GenericContainer;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
class PasswordResetRateLimiterTest {
    static GenericContainer<?> redis=new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);
    static LettuceConnectionFactory factory;
    StringRedisTemplate template;
    PasswordResetRateLimiter limits;
    @BeforeAll static void start() {
        redis.start();factory=new LettuceConnectionFactory(redis.getHost(),redis.getMappedPort(6379));factory.afterPropertiesSet();
    }
    @AfterAll static void stop() { if(factory!=null) factory.destroy();redis.stop(); }
    @BeforeEach void setup() {
        template=new StringRedisTemplate(factory);template.getConnectionFactory().getConnection().serverCommands().flushDb();
        var p=new PasswordResetProperties();p.setRequestPerEmail(2);p.setRequestPerIp(3);p.setConfirmationPerIp(2);p.setMailPerDay(2);
        limits=new PasswordResetRateLimiter(template,p);
    }
    @Test void normalizedMailboxAndIpLimitsHaveAtomicExpiryAndNoRawIdentifiers() {
        assertThat(limits.allowRequest(Optional.of("203.0.113.7")," Alice@Example.test ")).isTrue();
        assertThat(limits.allowRequest(Optional.of("203.0.113.8"),"alice@example.test")).isTrue();
        assertThat(limits.allowRequest(Optional.of("203.0.113.9"),"alice@example.test")).isFalse();
        assertThat(limits.allowRequest(Optional.of("203.0.113.7"),"other1@example.test")).isTrue();
        assertThat(limits.allowRequest(Optional.of("203.0.113.7"),"other2@example.test")).isTrue();
        assertThat(limits.allowRequest(Optional.of("203.0.113.7"),"other3@example.test")).isFalse();
        var keys=template.keys("password-reset-limit:*");
        assertThat(keys.toString()).doesNotContain("alice","@","203.0.113");
        for(String key:keys) assertThat(template.getExpire(key)).isPositive();
    }
    @Test void mailBudgetAndConfirmLimitAreEnforcedIncludingUnknownIp() {
        assertThat(limits.allowMail()).isTrue();assertThat(limits.allowMail()).isTrue();assertThat(limits.allowMail()).isFalse();
        limits.checkConfirmation(Optional.empty());limits.checkConfirmation(Optional.empty());
        assertThatThrownBy(()->limits.checkConfirmation(Optional.empty())).isInstanceOf(ToneBridgeException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.TOO_MANY_REQUESTS);
    }
    @Test void redisFailureFailsClosed() {
        var broken=org.mockito.Mockito.mock(StringRedisTemplate.class);
        org.mockito.Mockito.when(broken.execute(org.mockito.ArgumentMatchers.any(org.springframework.data.redis.core.script.RedisScript.class),
                org.mockito.ArgumentMatchers.anyList(),org.mockito.ArgumentMatchers.anyString())).thenThrow(new IllegalStateException("offline"));
        var unavailable=new PasswordResetRateLimiter(broken,new PasswordResetProperties());
        assertThatThrownBy(()->unavailable.allowRequest(Optional.empty(),"alice@example.test")).isInstanceOf(ToneBridgeException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.PASSWORD_RESET_UNAVAILABLE);
    }
}
