package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.yeonjae.tonebridge.adapter.in.web.dto.AccessTokenResponse;
import me.yeonjae.tonebridge.adapter.in.web.dto.TokenResponse;
import me.yeonjae.tonebridge.application.port.in.LoginWithGoogleUseCase;
import me.yeonjae.tonebridge.application.port.in.RefreshTokenUseCase;
import me.yeonjae.tonebridge.application.port.out.GoogleOAuthPort;
import me.yeonjae.tonebridge.application.port.out.OAuthStatePort;
import me.yeonjae.tonebridge.application.port.out.RefreshTokenPort;
import me.yeonjae.tonebridge.shared.config.JwtProperties;
import me.yeonjae.tonebridge.shared.config.ToneBridgeProperties;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    static final String REFRESH_COOKIE = "refresh_token";

    /** prod 프로파일에서 true — 로컬 개발(HTTP)에서는 false로 오버라이드 */
    @Value("${cookie.secure:true}")
    private boolean secureCookie;

    private final LoginWithGoogleUseCase loginWithGoogleUseCase;
    private final RefreshTokenUseCase refreshTokenUseCase;
    private final RefreshTokenPort refreshTokenPort;
    private final GoogleOAuthPort googleOAuthPort;
    private final OAuthStatePort oAuthStatePort;
    private final ToneBridgeProperties properties;
    private final JwtProperties jwtProperties;

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
            setRefreshCookie(response, tokens.refreshToken());
            String callbackUrl = frontendUrl + "/auth/callback"
                    + "#token=" + URLEncoder.encode(tokens.accessToken(), StandardCharsets.UTF_8);
            response.sendRedirect(callbackUrl);
        } catch (Exception e) {
            log.error("Google OAuth callback failed", e);
            response.sendRedirect(frontendUrl + "/login?error=oauth_failed");
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<AccessTokenResponse> refresh(HttpServletRequest request, HttpServletResponse response) {
        String refreshToken = extractRefreshCookie(request);
        if (refreshToken == null) {
            throw new ToneBridgeException(ErrorCode.INVALID_TOKEN);
        }
        TokenResponse tokens = refreshTokenUseCase.refresh(refreshToken);
        setRefreshCookie(response, tokens.refreshToken());
        return ResponseEntity.ok(new AccessTokenResponse(tokens.accessToken()));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        String refreshToken = extractRefreshCookie(request);
        if (refreshToken != null) {
            try {
                refreshTokenPort.delete(refreshToken);
            } catch (Exception e) {
                log.warn("Failed to delete refresh token from store during logout", e);
            }
        }
        clearRefreshCookie(response);
        return ResponseEntity.noContent().build();
    }

    // ── Cookie helpers ────────────────────────────────────────────────────────

    private void setRefreshCookie(HttpServletResponse response, String refreshToken) {
        // Math.toIntExact throws ArithmeticException on overflow so misconfiguration
        // is caught at runtime rather than silently producing a negative Max-Age.
        int maxAge = Math.toIntExact(jwtProperties.getRefreshTokenTtlMinutes() * 60);
        // Path=/api/auth restricts the cookie to auth endpoints only — the browser
        // will NOT send it on regular API calls, limiting exposure surface.
        // addHeader (not setHeader) is required: Set-Cookie is a multi-value header
        // and setHeader would overwrite any cookie set by other filters/interceptors.
        String secureFlag = secureCookie ? "; Secure" : "";
        response.addHeader("Set-Cookie", String.format(
                "%s=%s; Max-Age=%d; Path=/api/auth; HttpOnly%s; SameSite=Lax",
                REFRESH_COOKIE, refreshToken, maxAge, secureFlag));
    }

    private void clearRefreshCookie(HttpServletResponse response) {
        String secureFlag = secureCookie ? "; Secure" : "";
        response.addHeader("Set-Cookie", String.format(
                "%s=; Max-Age=0; Path=/api/auth; HttpOnly%s; SameSite=Lax",
                REFRESH_COOKIE, secureFlag));
    }

    private String extractRefreshCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        return Arrays.stream(request.getCookies())
                .filter(c -> REFRESH_COOKIE.equals(c.getName()))
                .map(Cookie::getValue)
                .findFirst()
                .orElse(null);
    }
}
