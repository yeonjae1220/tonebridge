package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.yeonjae.tonebridge.adapter.in.web.dto.TokenResponse;
import me.yeonjae.tonebridge.adapter.out.ai.GoogleUserInfo;
import me.yeonjae.tonebridge.application.port.in.LoginLocalUseCase;
import me.yeonjae.tonebridge.application.port.in.LoginWithGoogleUseCase;
import me.yeonjae.tonebridge.application.port.in.LoginWithIdTokenUseCase;
import me.yeonjae.tonebridge.application.port.in.RefreshTokenUseCase;
import me.yeonjae.tonebridge.application.port.in.RegisterLocalUserUseCase;
import me.yeonjae.tonebridge.application.port.out.CreditPort;
import me.yeonjae.tonebridge.application.port.out.GoogleOAuthPort;
import me.yeonjae.tonebridge.application.port.out.PasswordHasherPort;
import me.yeonjae.tonebridge.application.port.out.RefreshTokenPort;
import me.yeonjae.tonebridge.application.port.out.UserPort;
import me.yeonjae.tonebridge.domain.credit.CreditTransaction;
import me.yeonjae.tonebridge.domain.credit.TransactionType;
import me.yeonjae.tonebridge.domain.user.CorrectorLevel;
import me.yeonjae.tonebridge.domain.user.OAuthProvider;
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
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService implements LoginWithGoogleUseCase, LoginWithIdTokenUseCase,
        RefreshTokenUseCase, RegisterLocalUserUseCase, LoginLocalUseCase {

    private final UserPort userPort;
    private final CreditPort creditPort;
    private final GoogleOAuthPort googleOAuthPort;
    private final RefreshTokenPort refreshTokenPort;
    private final PasswordHasherPort passwordHasherPort;
    private final JwtProvider jwtProvider;
    private final JwtProperties jwtProperties;
    private final ToneBridgeProperties properties;

    @Override
    @Transactional
    public TokenResponse login(String code, String redirectUri) {
        return loginWithGoogleUser(googleOAuthPort.exchangeCodeForUserInfo(code, redirectUri));
    }

    @Override
    @Transactional
    public TokenResponse loginWithIdToken(String idToken) {
        return loginWithGoogleUser(googleOAuthPort.verifyIdToken(idToken));
    }

    private TokenResponse loginWithGoogleUser(GoogleUserInfo googleUser) {
        User user = userPort.findByEmail(googleUser.email())
                .orElseGet(() -> registerNewUser(googleUser));
        return issueTokens(user.id());
    }

    @Override
    @Transactional
    public TokenResponse register(String email, String username, String rawPassword) {
        String normalizedEmail = normalizeEmail(email);
        if (userPort.existsByEmail(normalizedEmail)) {
            throw new ToneBridgeException(ErrorCode.EMAIL_ALREADY_EXISTS);
        }
        if (userPort.existsByUsername(username)) {
            throw new ToneBridgeException(ErrorCode.USERNAME_ALREADY_EXISTS);
        }
        String passwordHash = passwordHasherPort.encode(rawPassword);
        User user = createUser(normalizedEmail, username, OAuthProvider.LOCAL, passwordHash);
        return issueTokens(user.id());
    }

    @Override
    @Transactional
    public TokenResponse loginLocal(String email, String rawPassword) {
        // 실패 사유(이메일 미존재 / 소셜 계정 / 비밀번호 불일치)를 구분하지 않고
        // 동일한 LOGIN_FAILED 로 응답 — 계정 열거(account enumeration) 방지.
        User user = userPort.findByEmail(normalizeEmail(email))
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.LOGIN_FAILED));
        if (!user.isLocalAccount()
                || !passwordHasherPort.matches(rawPassword, user.passwordHash())) {
            throw new ToneBridgeException(ErrorCode.LOGIN_FAILED);
        }
        return issueTokens(user.id());
    }

    @Override
    @Transactional
    public TokenResponse refresh(String refreshToken) {
        UUID tokenUserId = jwtProvider.extractRefreshUserId(refreshToken);
        UUID userId = refreshTokenPort.findUserIdByToken(refreshToken)
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.INVALID_TOKEN));
        if (!tokenUserId.equals(userId)) {
            throw new ToneBridgeException(ErrorCode.INVALID_TOKEN);
        }

        refreshTokenPort.delete(refreshToken);
        return issueTokens(userId);
    }

    private User registerNewUser(GoogleUserInfo googleUser) {
        String username = generateUsername(googleUser.email());
        return createUser(googleUser.email(), username, OAuthProvider.GOOGLE, null);
    }

    /**
     * 신규 회원을 기본값(언어 미설정 — 온보딩에서 채움)으로 생성하고 가입 보너스 크레딧을 지급한다.
     * Google/LOCAL 가입이 공유하는 단일 경로.
     */
    private User createUser(String email, String username, OAuthProvider provider, String passwordHash) {
        int signupBonus = properties.getCredit().getSignupBonus();
        boolean isAdmin = properties.getAdmin().getEmails().contains(email);

        User newUser = new User(
                null, email, username, "", "ko", List.of(), List.of(),
                null, Map.of(), Map.of(),
                signupBonus, 5.0, CorrectorLevel.NATIVE, 0, null, Instant.now(), isAdmin,
                provider, passwordHash
        );
        User saved = userPort.save(newUser);

        creditPort.save(new CreditTransaction(
                null, saved.id(), signupBonus, TransactionType.SIGNUP,
                null, "가입 축하 크레딧", Instant.now()
        ));

        log.info("New user registered: userId={}, provider={}", saved.id(), provider);
        return saved;
    }

    private String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    private TokenResponse issueTokens(UUID userId) {
        boolean isAdmin = userPort.findById(userId).map(User::isAdmin).orElse(false);
        String accessToken = jwtProvider.generateAccessToken(userId, isAdmin);
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
