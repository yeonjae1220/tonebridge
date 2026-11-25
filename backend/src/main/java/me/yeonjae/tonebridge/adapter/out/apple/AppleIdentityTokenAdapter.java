package me.yeonjae.tonebridge.adapter.out.apple;

import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.security.Jwk;
import io.jsonwebtoken.security.JwkSet;
import io.jsonwebtoken.security.Jwks;
import lombok.extern.slf4j.Slf4j;
import me.yeonjae.tonebridge.application.port.out.AppleIdentityTokenPort;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.security.Key;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

/**
 * Fetches Apple's signing keys (JWKS) and verifies identity tokens with them.
 *
 * <p>Keys are cached. An unknown {@code kid} triggers one refetch — Apple rotates keys —
 * but at most once per {@link #MIN_REFRESH_INTERVAL}, so forged kids cannot make us hammer Apple.
 */
@Slf4j
@Component
public class AppleIdentityTokenAdapter implements AppleIdentityTokenPort {

    private static final Duration MIN_REFRESH_INTERVAL = Duration.ofMinutes(1);

    private final String jwksUri;
    private final AppleIdentityTokenVerifier verifier;
    private final Clock clock = Clock.systemUTC();
    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .build();

    private volatile Map<String, Key> keys = Map.of();
    private volatile Instant lastFetch = Instant.EPOCH;

    public AppleIdentityTokenAdapter(
            @Value("${apple.sign-in.bundle-id}") String bundleId,
            @Value("${apple.sign-in.jwks-uri}") String jwksUri) {
        this.jwksUri = jwksUri;
        this.verifier = new AppleIdentityTokenVerifier(this::findKey, bundleId, clock);
    }

    @Override
    public AppleIdentity verify(String identityToken) {
        return verifier.verify(identityToken);
    }

    private Optional<Key> findKey(String kid) {
        Key key = keys.get(kid);
        if (key == null) {
            refreshKeys();
            key = keys.get(kid);
        }
        return Optional.ofNullable(key);
    }

    private synchronized void refreshKeys() {
        Instant now = clock.instant();
        if (now.isBefore(lastFetch.plus(MIN_REFRESH_INTERVAL))) {
            return;
        }
        lastFetch = now;
        Request request = new Request.Builder().url(jwksUri).get().build();
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                log.error("Apple JWKS fetch failed: HTTP {}", response.code());
                throw new ToneBridgeException(ErrorCode.APPLE_AUTH_FAILED);
            }
            JwkSet set = Jwks.setParser().build().parse(response.body().string());
            Map<String, Key> fresh = new HashMap<>();
            for (Jwk<?> jwk : set.getKeys()) {
                if (jwk.getId() != null) {
                    fresh.put(jwk.getId(), jwk.toKey());
                }
            }
            keys = Map.copyOf(fresh);
            log.info("Apple JWKS loaded: {} keys", fresh.size());
        } catch (IOException | JwtException | IllegalArgumentException e) {
            log.error("Apple JWKS fetch failed", e);
            throw new ToneBridgeException(ErrorCode.APPLE_AUTH_FAILED);
        }
    }
}
