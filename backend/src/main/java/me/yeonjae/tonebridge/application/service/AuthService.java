package me.yeonjae.tonebridge.application.service;

import jakarta.annotation.PostConstruct;
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
import java.util.Optional;
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

    /**
     * loginLocal의 "계정 없음/비-LOCAL 계정" 경로에서 비교할 더미 해시.
     * 실제 계정 비교와 동일한 BCrypt 비용을 지불해 응답 지연 차이로
     * 이메일 존재 여부가 드러나는 타이밍 사이드채널을 막는다.
     */
    private String dummyPasswordHash;

    @PostConstruct
    void initDummyPasswordHash() {
        dummyPasswordHash = passwordHasherPort.encode("tonebridge-constant-time-dummy-password");
    }

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
        // LOCAL 가입과 동일하게 정규화된 이메일로 조회/저장한다 — 대소문자 표기가 다른
        // 동일 이메일이 별개 계정으로 분기되거나 상호 조회에 실패하는 것을 방지.
        String normalizedEmail = normalizeEmail(googleUser.email());
        User user = userPort.findByEmail(normalizedEmail)
                .orElseGet(() -> registerNewUser(normalizedEmail));
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
        // 계정 미존재/비-LOCAL 경로에서도 더미 해시로 BCrypt 비교를 수행해 두 경로의
        // 응답 시간을 맞춘다 — 그렇지 않으면 비교를 건너뛰는 쪽이 더 빨리 응답해
        // 타이밍으로 이메일 존재 여부가 드러난다.
        Optional<User> localUser = userPort.findByEmail(normalizeEmail(email)).filter(User::isLocalAccount);
        String hashToCompare = localUser.map(User::passwordHash).orElse(dummyPasswordHash);
        boolean passwordMatches = passwordHasherPort.matches(rawPassword, hashToCompare);
        if (localUser.isEmpty() || !passwordMatches) {
            throw new ToneBridgeException(ErrorCode.LOGIN_FAILED);
        }
        return issueTokens(localUser.get().id());
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

    private User registerNewUser(String normalizedEmail) {
        String username = generateUsername(normalizedEmail);
        return createUser(normalizedEmail, username, OAuthProvider.GOOGLE, null);
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
