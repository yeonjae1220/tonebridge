package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.yeonjae.tonebridge.adapter.in.web.dto.TokenResponse;
import me.yeonjae.tonebridge.application.port.in.LoginWithGoogleUseCase;
import me.yeonjae.tonebridge.application.port.in.RefreshTokenUseCase;
import me.yeonjae.tonebridge.application.port.out.GoogleOAuthPort;
import me.yeonjae.tonebridge.application.port.out.OAuthStatePort;
import me.yeonjae.tonebridge.shared.config.ToneBridgeProperties;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final LoginWithGoogleUseCase loginWithGoogleUseCase;
    private final RefreshTokenUseCase refreshTokenUseCase;
    private final GoogleOAuthPort googleOAuthPort;
    private final OAuthStatePort oAuthStatePort;
    private final ToneBridgeProperties properties;

    @GetMapping("/google")
    public void initiateGoogleLogin(HttpServletResponse response) throws IOException {
        String state = oAuthStatePort.generateAndSave();
        String redirectUri = properties.getAuth().getRedirectUri();
        String authUrl = googleOAuthPort.buildAuthorizationUrl(redirectUri, state);
        response.sendRedirect(authUrl);
    }

    @GetMapping("/google/callback")
    public void handleGoogleCallback(
            @RequestParam String code,
            @RequestParam(required = false) String state,
            HttpServletResponse response
    ) throws IOException {
        String frontendUrl = properties.getAuth().getFrontendUrl();
        String redirectUri = properties.getAuth().getRedirectUri();

        if (state == null || !oAuthStatePort.validateAndConsume(state)) {
            log.warn("OAuth callback with invalid or missing state");
            response.sendRedirect(frontendUrl + "/login?error=invalid_state");
            return;
        }

        try {
            TokenResponse tokens = loginWithGoogleUseCase.login(code, redirectUri);
            String callbackUrl = frontendUrl + "/auth/callback"
                    + "#token=" + URLEncoder.encode(tokens.accessToken(), StandardCharsets.UTF_8)
                    + "&refresh=" + URLEncoder.encode(tokens.refreshToken(), StandardCharsets.UTF_8);
            response.sendRedirect(callbackUrl);
        } catch (Exception e) {
            log.error("Google OAuth callback failed", e);
            response.sendRedirect(frontendUrl + "/login?error=oauth_failed");
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<TokenResponse> refresh(@RequestBody RefreshRequest request) {
        return ResponseEntity.ok(refreshTokenUseCase.refresh(request.refreshToken()));
    }

    public record RefreshRequest(String refreshToken) {}
}
