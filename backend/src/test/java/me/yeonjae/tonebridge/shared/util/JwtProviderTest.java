package me.yeonjae.tonebridge.shared.util;

import me.yeonjae.tonebridge.shared.config.JwtProperties;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtProviderTest {

    private JwtProvider jwtProvider;

    @BeforeEach
    void setUp() {
        JwtProperties properties = new JwtProperties();
        properties.setSecret("test-secret-key-that-is-long-enough-for-hs256-signing");
        properties.setAccessTokenTtlMinutes(15);
        properties.setRefreshTokenTtlMinutes(60);
        jwtProvider = new JwtProvider(properties);
    }

    @Test
    void accessTokenCannotBeUsedAsRefreshToken() {
        UUID userId = UUID.randomUUID();
        String accessToken = jwtProvider.generateAccessToken(userId);

        assertThat(jwtProvider.extractAccessUserId(accessToken)).isEqualTo(userId);
        assertThatThrownBy(() -> jwtProvider.extractRefreshUserId(accessToken))
                .isInstanceOf(ToneBridgeException.class)
                .extracting(e -> ((ToneBridgeException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_TOKEN);
    }

    @Test
    void refreshTokenCannotBeUsedAsAccessToken() {
        UUID userId = UUID.randomUUID();
        String refreshToken = jwtProvider.generateRefreshToken(userId);

        assertThat(jwtProvider.extractRefreshUserId(refreshToken)).isEqualTo(userId);
        assertThatThrownBy(() -> jwtProvider.extractAccessUserId(refreshToken))
                .isInstanceOf(ToneBridgeException.class)
                .extracting(e -> ((ToneBridgeException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_TOKEN);
    }
}
