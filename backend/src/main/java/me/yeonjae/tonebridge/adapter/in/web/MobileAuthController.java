package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.yeonjae.tonebridge.adapter.in.web.dto.MobileAuthResponse;
import me.yeonjae.tonebridge.adapter.in.web.dto.MobileIdTokenRequest;
import me.yeonjae.tonebridge.adapter.in.web.dto.MobileRefreshRequest;
import me.yeonjae.tonebridge.adapter.in.web.dto.UserResponse;
import me.yeonjae.tonebridge.application.port.in.GetCurrentUserUseCase;
import me.yeonjae.tonebridge.application.port.in.LoginWithIdTokenUseCase;
import me.yeonjae.tonebridge.application.port.in.RefreshTokenUseCase;
import me.yeonjae.tonebridge.application.port.out.RefreshTokenPort;
import me.yeonjae.tonebridge.shared.util.JwtProvider;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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

    @PostMapping("/google/id-token")
    public ResponseEntity<MobileAuthResponse> verifyIdToken(
            @Valid @RequestBody MobileIdTokenRequest request) {
        var tokens = loginWithIdTokenUseCase.loginWithIdToken(request.idToken());
        return ResponseEntity.ok(toMobileAuthResponse(tokens.accessToken(), tokens.refreshToken()));
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
