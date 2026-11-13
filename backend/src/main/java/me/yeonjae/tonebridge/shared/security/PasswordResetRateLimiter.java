package me.yeonjae.tonebridge.shared.security;
import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.shared.config.PasswordResetProperties;
import me.yeonjae.tonebridge.shared.exception.*;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
@Component
public class PasswordResetRateLimiter {
    private final RedisTemplate<String,String> redis;
    private final PasswordResetProperties properties;
    public PasswordResetRateLimiter(@org.springframework.beans.factory.annotation.Qualifier("redisTemplate") RedisTemplate<String,String> redis, PasswordResetProperties properties) {
        this.redis=redis;this.properties=properties;
    }
    private static final DefaultRedisScript<Long> HIT = new DefaultRedisScript<>(
            "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",Long.class);
    public boolean allowRequest(Optional<String> ip,String email) {
        boolean address=hit("request-ip:"+TokenDigest.sha256(ip.orElse("unknown")),properties.getRequestPerIp(),900);
        boolean mailbox=hit("request-email:"+TokenDigest.sha256(email.trim().toLowerCase(Locale.ROOT)),properties.getRequestPerEmail(),3600);
        return address && mailbox;
    }
    public boolean allowMail() { return hit("mail-budget",properties.getMailPerDay(),86400); }
    public void checkConfirmation(Optional<String> ip) {
        if (!hit("confirm-ip:"+TokenDigest.sha256(ip.orElse("unknown")),properties.getConfirmationPerIp(),900))
            throw new ToneBridgeException(ErrorCode.TOO_MANY_REQUESTS);
    }
    private boolean hit(String suffix,int limit,int ttl) {
        try {
            Long count=redis.execute(HIT,List.of("password-reset-limit:"+suffix),Integer.toString(ttl));
            if (count==null) throw new IllegalStateException("Missing rate counter");
            return count<=limit;
        } catch (RuntimeException ex) {
            // Fail closed; do not expose keys, addresses, credentials or Redis exception messages.
            throw new ToneBridgeException(ErrorCode.PASSWORD_RESET_UNAVAILABLE);
        }
    }
}
