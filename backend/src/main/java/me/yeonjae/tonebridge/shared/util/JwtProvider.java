package me.yeonjae.tonebridge.shared.util;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.yeonjae.tonebridge.shared.config.JwtProperties;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtProvider {

    private static final String TOKEN_TYPE_CLAIM = "token_type";
    private static final String ACCESS_TOKEN_TYPE = "access";
    private static final String REFRESH_TOKEN_TYPE = "refresh";
    private static final String ADMIN_CLAIM = "admin";

    /** Minimum secret length for HMAC-SHA256 (256 bits = 32 bytes). */
    private static final int MIN_SECRET_BYTES = 32;

    private final JwtProperties jwtProperties;

    @PostConstruct
    void validateSecret() {
        String secret = jwtProperties.getSecret();
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException(
                    "[Security] JWT_SECRET is not configured. Set the JWT_SECRET environment variable.");
        }
        if (secret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
            throw new IllegalStateException(
                    "[Security] JWT_SECRET is too short. Minimum " + MIN_SECRET_BYTES
                            + " bytes required for HMAC-SHA256.");
        }
    }

    public String generateAccessToken(UUID userId, boolean isAdmin) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(userId.toString())
                .claim(TOKEN_TYPE_CLAIM, ACCESS_TOKEN_TYPE)
                .claim(ADMIN_CLAIM, isAdmin)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(jwtProperties.getAccessTokenTtlMinutes() * 60)))
                .signWith(signingKey())
                .compact();
    }

    public String generateRefreshToken(UUID userId) {
        return buildToken(userId.toString(), jwtProperties.getRefreshTokenTtlMinutes(), REFRESH_TOKEN_TYPE);
    }

    public record AccessClaims(UUID userId, boolean isAdmin) {}

    /**
     * Parses an access token once and returns both userId and admin flag.
     * Throws ToneBridgeException if the token is invalid, expired, or is not an access token.
     */
    public AccessClaims parseAccessClaims(String token) {
        Claims claims = parseClaims(token);
        validateTokenType(claims, ACCESS_TOKEN_TYPE);
        UUID userId = UUID.fromString(claims.getSubject());
        boolean isAdmin = Boolean.TRUE.equals(claims.get(ADMIN_CLAIM, Boolean.class));
        return new AccessClaims(userId, isAdmin);
    }

    public UUID extractRefreshUserId(String token) {
        Claims claims = parseClaims(token);
        validateTokenType(claims, REFRESH_TOKEN_TYPE);
        return UUID.fromString(claims.getSubject());
    }

    public boolean isValid(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private String buildToken(String subject, long ttlMinutes, String tokenType) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(subject)
                .claim(TOKEN_TYPE_CLAIM, tokenType)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(ttlMinutes * 60)))
                .signWith(signingKey())
                .compact();
    }

    private void validateTokenType(Claims claims, String expectedType) {
        if (!expectedType.equals(claims.get(TOKEN_TYPE_CLAIM, String.class))) {
            throw new ToneBridgeException(ErrorCode.INVALID_TOKEN);
        }
    }

    private Claims parseClaims(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(signingKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (ExpiredJwtException e) {
            throw new ToneBridgeException(ErrorCode.TOKEN_EXPIRED);
        } catch (JwtException e) {
            throw new ToneBridgeException(ErrorCode.INVALID_TOKEN);
        }
    }

    private SecretKey signingKey() {
        return Keys.hmacShaKeyFor(jwtProperties.getSecret().getBytes(StandardCharsets.UTF_8));
    }
}
