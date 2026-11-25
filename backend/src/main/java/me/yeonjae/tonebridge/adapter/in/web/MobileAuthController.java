package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.yeonjae.tonebridge.adapter.in.web.dto.LoginRequest;
import me.yeonjae.tonebridge.adapter.in.web.dto.MobileAppleRequest;
import me.yeonjae.tonebridge.adapter.in.web.dto.MobileAuthResponse;
import me.yeonjae.tonebridge.adapter.in.web.dto.MobileIdTokenRequest;
import me.yeonjae.tonebridge.adapter.in.web.dto.MobileRefreshRequest;
import me.yeonjae.tonebridge.adapter.in.web.dto.RegisterRequest;
import me.yeonjae.tonebridge.adapter.in.web.dto.TokenResponse;
import me.yeonjae.tonebridge.adapter.in.web.dto.UserResponse;
import me.yeonjae.tonebridge.application.port.in.GetCurrentUserUseCase;
import me.yeonjae.tonebridge.application.port.in.LoginLocalUseCase;
import me.yeonjae.tonebridge.application.port.in.LoginWithAppleUseCase;
import me.yeonjae.tonebridge.application.port.in.LoginWithIdTokenUseCase;
import me.yeonjae.tonebridge.application.port.in.RefreshTokenUseCase;
import me.yeonjae.tonebridge.application.port.in.RegisterLocalUserUseCase;
import me.yeonjae.tonebridge.application.port.out.RefreshTokenPort;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import me.yeonjae.tonebridge.shared.security.ClientIpResolver;
import me.yeonjae.tonebridge.shared.security.LoginRateLimiter;
import me.yeonjae.tonebridge.shared.util.JwtProvider;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/auth/mobile")
@RequiredArgsConstructor
public class MobileAuthController {

    private final LoginWithIdTokenUseCase loginWithIdTokenUseCase;
    private final RefreshTokenUseCase refreshTokenUseCase;
    private final RefreshTokenPort refreshTokenPort;
    private final GetCurrentUserUseCase getCurrentUserUseCase;
    private final JwtProvider jwtProvider;
    private final LoginLocalUseCase loginLocalUseCase;
    private final LoginWithAppleUseCase loginWithAppleUseCase;
    private final RegisterLocalUserUseCase registerLocalUserUseCase;
    private final LoginRateLimiter loginRateLimiter;
    private final ClientIpResolver clientIpResolver;

    @PostMapping("/google/id-token")
    public ResponseEntity<MobileAuthResponse> verifyIdToken(
            @Valid @RequestBody MobileIdTokenRequest request) {
        var tokens = loginWithIdTokenUseCase.loginWithIdToken(request.idToken());
        return ResponseEntity.ok(toMobileAuthResponse(tokens.accessToken(), tokens.refreshToken()));
    }

    @PostMapping("/apple")
    public ResponseEntity<MobileAuthResponse> signInWithApple(
            @Valid @RequestBody MobileAppleRequest request) {
        var tokens = loginWithAppleUseCase.loginWithApple(request.identityToken());
        return ResponseEntity.ok(toMobileAuthResponse(tokens.accessToken(), tokens.refreshToken()));
    }

    /**
     * 이메일/비밀번호 로그인 — 웹 {@code POST /api/auth/login} 과 같은 규칙(실패만 카운트하는 rate limit,
     * 계정 열거 방지)을 따르되 refresh 토큰을 쿠키가 아닌 본문으로 돌려준다. 앱은 secure storage 에 둔다.
     * 스토어 심사 계정·Google/Apple 이 없는 사용자를 위한 경로다.
     */
    @PostMapping("/login")
    public ResponseEntity<MobileAuthResponse> login(
            @Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        Optional<String> clientIp = clientIpResolver.resolve(httpRequest);
        loginRateLimiter.checkLogin(clientIp, request.email());
        TokenResponse tokens;
        try {
            tokens = loginLocalUseCase.loginLocal(request.email(), request.password());
        } catch (ToneBridgeException e) {
            loginRateLimiter.recordLoginFailure(clientIp, request.email());
            throw e;
        }
        return ResponseEntity.ok(toMobileAuthResponse(tokens.accessToken(), tokens.refreshToken()));
    }

    @PostMapping("/register")
    public ResponseEntity<MobileAuthResponse> register(
            @Valid @RequestBody RegisterRequest request, HttpServletRequest httpRequest) {
        loginRateLimiter.checkRegister(clientIpResolver.resolve(httpRequest), request.email());
        TokenResponse tokens = registerLocalUserUseCase.register(
                request.email(), request.username(), request.password());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(toMobileAuthResponse(tokens.accessToken(), tokens.refreshToken()));
    }

    @PostMapping("/refresh")
    public ResponseEntity<MobileAuthResponse> refresh(
            @Valid @RequestBody MobileRefreshRequest request) {
        var tokens = refreshTokenUseCase.refresh(request.refreshToken());
        return ResponseEntity.ok(toMobileAuthResponse(tokens.accessToken(), tokens.refreshToken()));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@Valid @RequestBody MobileRefreshRequest request) {
        refreshTokenPort.delete(request.refreshToken());
        return ResponseEntity.noContent().build();
    }

    private MobileAuthResponse toMobileAuthResponse(String accessToken, String refreshToken) {
        UUID userId = jwtProvider.parseAccessClaims(accessToken).userId();
        UserResponse user = UserResponse.from(getCurrentUserUseCase.get(userId));
        return new MobileAuthResponse(accessToken, refreshToken, !user.onboardingCompleted(), user);
    }
}
