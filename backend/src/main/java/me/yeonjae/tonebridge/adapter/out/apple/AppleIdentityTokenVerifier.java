package me.yeonjae.tonebridge.adapter.out.apple;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.LocatorAdapter;
import io.jsonwebtoken.ProtectedHeader;
import me.yeonjae.tonebridge.application.port.out.AppleIdentityTokenPort.AppleIdentity;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;

import java.security.Key;
import java.time.Clock;
import java.util.Date;
import java.util.Optional;
import java.util.function.Function;

/**
 * Verifies an Apple identity token against Apple's public keys.
 *
 * <p>Pure apart from the key lookup, so it can be tested with locally generated keys.
 * Checks: RS256 signature by a key Apple publishes, {@code iss}, {@code aud} (our bundle id), expiry.
 */
public final class AppleIdentityTokenVerifier {

    static final String ISSUER = "https://appleid.apple.com";

    private final Function<String, Optional<Key>> keyById;
    private final String audience;
    private final Clock clock;

    public AppleIdentityTokenVerifier(Function<String, Optional<Key>> keyById, String audience, Clock clock) {
        if (audience == null || audience.isBlank()) {
            throw new IllegalArgumentException("Apple audience (bundle id) must be set");
        }
        this.keyById = keyById;
        this.audience = audience;
        this.clock = clock;
    }

    public AppleIdentity verify(String identityToken) {
        Claims claims;
        try {
            claims = Jwts.parser()
                    .keyLocator(new LocatorAdapter<>() {
                        @Override
                        protected Key locate(ProtectedHeader header) {
                            String kid = header.getKeyId();
                            if (kid == null) {
                                throw new JwtException("Apple identity token has no kid");
                            }
                            return keyById.apply(kid)
                                    .orElseThrow(() -> new JwtException("Unknown Apple key id " + kid));
                        }
                    })
                    .requireIssuer(ISSUER)
                    .requireAudience(audience)
                    .clock(() -> Date.from(clock.instant()))
                    .build()
                    .parseSignedClaims(identityToken)
                    .getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            throw new ToneBridgeException(ErrorCode.APPLE_AUTH_FAILED);
        }

        String sub = claims.getSubject();
        if (sub == null || sub.isBlank()) {
            throw new ToneBridgeException(ErrorCode.APPLE_AUTH_FAILED);
        }
        String email = claims.get("email", String.class);
        return new AppleIdentity(sub, email, isTrue(claims.get("email_verified")));
    }

    /** Apple sends email_verified as either a JSON boolean or the string "true". */
    private static boolean isTrue(Object value) {
        return Boolean.TRUE.equals(value) || "true".equals(value);
    }
}
