package me.yeonjae.tonebridge.application.service;

import me.yeonjae.tonebridge.adapter.in.web.dto.TokenResponse;
import me.yeonjae.tonebridge.application.port.out.CreditPort;
import me.yeonjae.tonebridge.application.port.out.GoogleOAuthPort;
import me.yeonjae.tonebridge.application.port.out.PasswordHasherPort;
import me.yeonjae.tonebridge.application.port.out.RefreshTokenPort;
import me.yeonjae.tonebridge.application.port.out.UserPort;
import me.yeonjae.tonebridge.domain.credit.CreditTransaction;
import me.yeonjae.tonebridge.domain.user.CorrectorLevel;
import me.yeonjae.tonebridge.domain.user.OAuthProvider;
import me.yeonjae.tonebridge.domain.user.User;
import me.yeonjae.tonebridge.shared.config.JwtProperties;
import me.yeonjae.tonebridge.shared.config.ToneBridgeProperties;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import me.yeonjae.tonebridge.shared.util.JwtProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuthService 로컬 회원가입/로그인")
class AuthServiceLocalAuthTest {

    @Mock private UserPort userPort;
    @Mock private CreditPort creditPort;
    @Mock private GoogleOAuthPort googleOAuthPort;
    @Mock private RefreshTokenPort refreshTokenPort;
    @Mock private PasswordHasherPort passwordHasherPort;
    @Mock private JwtProvider jwtProvider;

    // 실제 인스턴스 사용 — 기본값(signupBonus=30, ttl=43200, admin emails 비어있음)
    private final JwtProperties jwtProperties = new JwtProperties();
    private final ToneBridgeProperties properties = new ToneBridgeProperties();

    private AuthService authService;

    @BeforeEach
    void setUp() {
        when(passwordHasherPort.encode("tonebridge-constant-time-dummy-password")).thenReturn("DUMMY_HASH");
        authService = new AuthService(userPort, creditPort, googleOAuthPort, refreshTokenPort,
                passwordHasherPort, jwtProvider, jwtProperties, properties);
        authService.initDummyPasswordHash();
    }

    private User localUser(UUID id, String email, String username, String passwordHash) {
        return new User(id, email, username, "", "ko", List.of(), List.of(),
                null, Map.of(), Map.of(),
                30, 5.0, CorrectorLevel.NATIVE, 0, null, Instant.now(), false,
                OAuthProvider.LOCAL, passwordHash);
    }

    // ── register ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("register: 신규 이메일이면 비밀번호를 해시하고 가입 보너스를 지급한 뒤 토큰을 발급한다")
    void register_newUser_issuesTokensAndGrantsBonus() {
        UUID newId = UUID.randomUUID();
        when(userPort.existsByEmail("alice@example.com")).thenReturn(false);
        when(userPort.existsByUsername("alice")).thenReturn(false);
        when(passwordHasherPort.encode("Str0ng!pw")).thenReturn("HASHED");
        when(userPort.save(any(User.class)))
                .thenReturn(localUser(newId, "alice@example.com", "alice", "HASHED"));
        when(userPort.findById(newId))
                .thenReturn(Optional.of(localUser(newId, "alice@example.com", "alice", "HASHED")));
        when(jwtProvider.generateAccessToken(eq(newId), eq(false))).thenReturn("ACCESS");
        when(jwtProvider.generateRefreshToken(newId)).thenReturn("REFRESH");

        TokenResponse result = authService.register("Alice@Example.com", "alice", "Str0ng!pw");

        assertThat(result.accessToken()).isEqualTo("ACCESS");
        assertThat(result.refreshToken()).isEqualTo("REFRESH");
        verify(passwordHasherPort).encode("Str0ng!pw");
        verify(creditPort).save(any(CreditTransaction.class));
        verify(refreshTokenPort).save(eq("REFRESH"), eq(newId), anyLong());
    }

    @Test
    @DisplayName("register: 이메일은 소문자로 정규화되어 중복 검사된다")
    void register_normalizesEmailToLowercase() {
        when(userPort.existsByEmail("alice@example.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.register("Alice@Example.com", "alice", "Str0ng!pw"))
                .isInstanceOf(ToneBridgeException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.EMAIL_ALREADY_EXISTS);
        // setUp()의 @PostConstruct가 더미 해시를 인코딩하므로 encode(anyString())는 이미 호출된 상태 —
        // 여기서 확인할 것은 "실제 입력 비밀번호"가 해시되지 않았다는 점이다.
        verify(passwordHasherPort, never()).encode("Str0ng!pw");
    }

    @Test
    @DisplayName("register: 닉네임이 중복이면 USERNAME_ALREADY_EXISTS")
    void register_duplicateUsername_throws() {
        when(userPort.existsByEmail(anyString())).thenReturn(false);
        when(userPort.existsByUsername("alice")).thenReturn(true);

        assertThatThrownBy(() -> authService.register("alice@example.com", "alice", "Str0ng!pw"))
                .isInstanceOf(ToneBridgeException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.USERNAME_ALREADY_EXISTS);
        verify(userPort, never()).save(any());
    }

    // ── loginLocal ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("loginLocal: 비밀번호가 일치하면 토큰을 발급한다")
    void loginLocal_validPassword_issuesTokens() {
        UUID id = UUID.randomUUID();
        User user = localUser(id, "alice@example.com", "alice", "HASHED");
        when(userPort.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
        when(passwordHasherPort.matches("Str0ng!pw", "HASHED")).thenReturn(true);
        when(userPort.findById(id)).thenReturn(Optional.of(user));
        when(jwtProvider.generateAccessToken(eq(id), eq(false))).thenReturn("ACCESS");
        when(jwtProvider.generateRefreshToken(id)).thenReturn("REFRESH");

        TokenResponse result = authService.loginLocal("Alice@Example.com", "Str0ng!pw");

        assertThat(result.accessToken()).isEqualTo("ACCESS");
    }

    @Test
    @DisplayName("loginLocal: 존재하지 않는 이메일은 LOGIN_FAILED — 더미 해시로 비교해 응답 시간을 맞춘다")
    void loginLocal_unknownEmail_throwsLoginFailed() {
        when(userPort.findByEmail("ghost@example.com")).thenReturn(Optional.empty());
        when(passwordHasherPort.matches("whatever1!A", "DUMMY_HASH")).thenReturn(false);

        assertThatThrownBy(() -> authService.loginLocal("ghost@example.com", "whatever1!A"))
                .isInstanceOf(ToneBridgeException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.LOGIN_FAILED);
        // 계정이 없어도 더미 해시와 BCrypt 비교를 수행해 동일한 비용을 지불한다 — 타이밍 사이드채널 방지
        verify(passwordHasherPort).matches("whatever1!A", "DUMMY_HASH");
    }

    @Test
    @DisplayName("loginLocal: 비밀번호 불일치는 LOGIN_FAILED")
    void loginLocal_wrongPassword_throwsLoginFailed() {
        UUID id = UUID.randomUUID();
        when(userPort.findByEmail("alice@example.com"))
                .thenReturn(Optional.of(localUser(id, "alice@example.com", "alice", "HASHED")));
        when(passwordHasherPort.matches("wrong", "HASHED")).thenReturn(false);

        assertThatThrownBy(() -> authService.loginLocal("alice@example.com", "wrong"))
                .isInstanceOf(ToneBridgeException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.LOGIN_FAILED);
    }

    @Test
    @DisplayName("loginLocal: GOOGLE 계정으로는 비밀번호 로그인이 불가하며 LOGIN_FAILED (계정 열거 방지)")
    void loginLocal_googleAccount_throwsLoginFailed() {
        UUID id = UUID.randomUUID();
        User googleUser = new User(id, "alice@example.com", "alice", "", "ko", List.of(), List.of(),
                null, Map.of(), Map.of(), 30, 5.0, CorrectorLevel.NATIVE, 0, null, Instant.now(), false,
                OAuthProvider.GOOGLE, null);
        when(userPort.findByEmail("alice@example.com")).thenReturn(Optional.of(googleUser));
        when(passwordHasherPort.matches("Str0ng!pw", "DUMMY_HASH")).thenReturn(false);

        assertThatThrownBy(() -> authService.loginLocal("alice@example.com", "Str0ng!pw"))
                .isInstanceOf(ToneBridgeException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.LOGIN_FAILED);
        // GOOGLE 계정의 passwordHash(null)가 아닌 더미 해시로 비교한다 — 계정 존재 여부가 타이밍으로 드러나지 않도록
        verify(passwordHasherPort).matches("Str0ng!pw", "DUMMY_HASH");
    }
}
