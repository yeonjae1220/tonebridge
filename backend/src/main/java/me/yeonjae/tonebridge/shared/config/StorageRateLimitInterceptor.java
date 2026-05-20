package me.yeonjae.tonebridge.shared.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.List;

/**
 * Redis-based fixed-window rate limiter for /api/storage presigned URL endpoints.
 *
 * <p>Allows up to {@code tonebridge.storage.rate-limit-per-minute} requests per
 * authenticated user per 60-second window.  Uses an atomic Lua script so the
 * INCR + EXPIRE pair is never split across a Redis failure.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class StorageRateLimitInterceptor implements HandlerInterceptor {

    private final StringRedisTemplate redis;
    private final ToneBridgeProperties properties;

    private static final String KEY_PREFIX = "rate:storage:";
    private static final String HEADER_RETRY_AFTER = "Retry-After";
    private static final String RESPONSE_BODY =
            "{\"code\":\"STORAGE_429\",\"message\":\"Too many presigned-URL requests. Retry after 60 seconds.\"}";

    /**
     * Atomic Lua: increment the counter and set a 60-second TTL on first access.
     * Returns the new counter value.
     */
    private static final RedisScript<Long> RATE_LIMIT_SCRIPT = RedisScript.of(
            "local c = redis.call('INCR', KEYS[1])\n" +
            "if c == 1 then redis.call('EXPIRE', KEYS[1], 60) end\n" +
            "return c",
            Long.class
    );

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) throws Exception {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        // AnonymousAuthenticationToken.isAuthenticated() returns true — check explicitly
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) {
            return true; // unauthenticated — let Spring Security handle 401
        }

        String userId = auth.getPrincipal().toString();
        String key = KEY_PREFIX + userId;
        int limit = properties.getStorage().getRateLimitPerMinute();

        Long count = redis.execute(RATE_LIMIT_SCRIPT, List.of(key));

        if (count != null && count > limit) {
            log.warn("Storage rate limit exceeded: userId={} count={} limit={}", userId, count, limit);
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setHeader(HEADER_RETRY_AFTER, "60");
            response.getWriter().write(RESPONSE_BODY);
            return false;
        }
        return true;
    }
}
