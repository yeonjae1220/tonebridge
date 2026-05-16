package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.yeonjae.tonebridge.adapter.in.web.dto.TokenResponse;
import me.yeonjae.tonebridge.adapter.out.ai.GoogleUserInfo;
import me.yeonjae.tonebridge.application.port.in.LoginWithGoogleUseCase;
import me.yeonjae.tonebridge.application.port.in.RefreshTokenUseCase;
import me.yeonjae.tonebridge.application.port.out.CreditPort;
import me.yeonjae.tonebridge.application.port.out.GoogleOAuthPort;
import me.yeonjae.tonebridge.application.port.out.RefreshTokenPort;
import me.yeonjae.tonebridge.application.port.out.UserPort;
import me.yeonjae.tonebridge.domain.credit.CreditTransaction;
import me.yeonjae.tonebridge.domain.credit.TransactionType;
import me.yeonjae.tonebridge.domain.user.CorrectorLevel;
import me.yeonjae.tonebridge.domain.user.User;
import me.yeonjae.tonebridge.shared.config.JwtProperties;
import me.yeonjae.tonebridge.shared.config.ToneBridgeProperties;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import me.yeonjae.tonebridge.shared.util.JwtProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService implements LoginWithGoogleUseCase, RefreshTokenUseCase {

    private final UserPort userPort;
    private final CreditPort creditPort;
    private final GoogleOAuthPort googleOAuthPort;
    private final RefreshTokenPort refreshTokenPort;
    private final JwtProvider jwtProvider;
    private final JwtProperties jwtProperties;
    private final ToneBridgeProperties properties;

    @Override
    @Transactional
    public TokenResponse login(String code, String redirectUri) {
        GoogleUserInfo googleUser = googleOAuthPort.exchangeCodeForUserInfo(code, redirectUri);

        User user = userPort.findByEmail(googleUser.email())
                .orElseGet(() -> registerNewUser(googleUser));

        return issueTokens(user.id());
    }

    @Override
    @Transactional
    public TokenResponse refresh(String refreshToken) {
        UUID userId = refreshTokenPort.findUserIdByToken(refreshToken)
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.INVALID_TOKEN));

        refreshTokenPort.delete(refreshToken);
        return issueTokens(userId);
    }

    private User registerNewUser(GoogleUserInfo googleUser) {
        int signupBonus = properties.getCredit().getSignupBonus();
        String username = generateUsername(googleUser.email());

        User newUser = new User(
                null, googleUser.email(), username, "", List.of(), List.of(),
                signupBonus, 5.0, CorrectorLevel.NATIVE, 0, null, Instant.now()
        );
        User saved = userPort.save(newUser);

        creditPort.save(new CreditTransaction(
                null, saved.id(), signupBonus, TransactionType.SIGNUP,
                null, "가입 축하 크레딧", Instant.now()
        ));

        log.info("New user registered: userId={}", saved.id());
        return saved;
    }

    private TokenResponse issueTokens(UUID userId) {
        String accessToken = jwtProvider.generateAccessToken(userId);
        String refreshToken = jwtProvider.generateRefreshToken(userId);
        long ttlSeconds = jwtProperties.getRefreshTokenTtlMinutes() * 60;
        refreshTokenPort.save(refreshToken, userId, ttlSeconds);
        return new TokenResponse(accessToken, refreshToken);
    }

    private String generateUsername(String email) {
        String base = email.split("@")[0].replaceAll("[^a-zA-Z0-9]", "");
        return base + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    }
}
