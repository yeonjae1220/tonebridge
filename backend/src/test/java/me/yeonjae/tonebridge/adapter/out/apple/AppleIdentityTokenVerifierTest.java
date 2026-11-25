package me.yeonjae.tonebridge.adapter.out.apple;

import io.jsonwebtoken.Jwts;
import me.yeonjae.tonebridge.application.port.out.AppleIdentityTokenPort.AppleIdentity;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.security.Key;
import java.security.KeyPair;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Date;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AppleIdentityTokenVerifierTest {

    private static final String BUNDLE_ID = "com.mungji.tonebridge";
    private static final String KID = "apple-key-1";
    private static final Instant NOW = Instant.parse("2026-11-25T12:00:00Z");

    private final KeyPair appleKeys = Jwts.SIG.RS256.keyPair().build();
    private final KeyPair attackerKeys = Jwts.SIG.RS256.keyPair().build();
    private final Map<String, Key> published = Map.of(KID, appleKeys.getPublic());
    private final AppleIdentityTokenVerifier verifier = new AppleIdentityTokenVerifier(
            kid -> Optional.ofNullable(published.get(kid)), BUNDLE_ID, Clock.fixed(NOW, ZoneOffset.UTC));

    private io.jsonwebtoken.JwtBuilder token() {
        return Jwts.builder()
                .header().keyId(KID).and()
                .issuer("https://appleid.apple.com")
                .audience().add(BUNDLE_ID).and()
                .subject("001234.abcdef.1234")
                .issuedAt(Date.from(NOW.minusSeconds(10)))
                .expiration(Date.from(NOW.plus(Duration.ofMinutes(5))))
                .signWith(appleKeys.getPrivate());
    }

    @Test
    @DisplayName("returns sub, email and verification for a token Apple signed for our bundle id")
    void acceptsValidToken() {
        AppleIdentity identity = verifier.verify(token()
                .claim("email", "abc@privaterelay.appleid.com")
                .claim("email_verified", "true")
                .compact());

        assertThat(identity).isEqualTo(new AppleIdentity("001234.abcdef.1234", "abc@privaterelay.appleid.com", true));
    }

    @Test
    @DisplayName("email may be absent; email_verified as a JSON boolean is understood")
    void handlesMissingEmailAndBooleanVerified() {
        assertThat(verifier.verify(token().compact()).email()).isNull();
        assertThat(verifier.verify(token().claim("email", "a@b.c").claim("email_verified", true).compact())
                .emailVerified()).isTrue();
        assertThat(verifier.verify(token().claim("email", "a@b.c").claim("email_verified", "false").compact())
                .emailVerified()).isFalse();
    }

    @Test
    @DisplayName("rejects a token for another app (aud)")
    void rejectsWrongAudience() {
        assertRejected(token().audience().single("com.other.app").compact());
    }

    @Test
    @DisplayName("rejects a token not issued by Apple")
    void rejectsWrongIssuer() {
        assertRejected(token().issuer("https://evil.example").compact());
    }

    @Test
    @DisplayName("rejects an expired token")
    void rejectsExpired() {
        assertRejected(token().expiration(Date.from(NOW.minusSeconds(120))).compact());
    }

    @Test
    @DisplayName("rejects a token signed with a key Apple did not publish, even if it claims Apple's kid")
    void rejectsForgedSignature() {
        assertRejected(token().signWith(attackerKeys.getPrivate()).compact());
    }

    @Test
    @DisplayName("rejects unknown kid, missing kid, unsigned and garbage tokens")
    void rejectsMalformed() {
        assertRejected(token().header().keyId("unknown").and().compact());
        assertRejected(Jwts.builder().subject("x").issuer("https://appleid.apple.com")
                .audience().add(BUNDLE_ID).and().signWith(appleKeys.getPrivate()).compact());
        assertRejected(Jwts.builder().subject("x").compact());
        assertRejected("not-a-jwt");
    }

    private void assertRejected(String jwt) {
        assertThatThrownBy(() -> verifier.verify(jwt))
                .isInstanceOf(ToneBridgeException.class)
                .extracting(e -> ((ToneBridgeException) e).getErrorCode())
                .isEqualTo(ErrorCode.APPLE_AUTH_FAILED);
    }
}
