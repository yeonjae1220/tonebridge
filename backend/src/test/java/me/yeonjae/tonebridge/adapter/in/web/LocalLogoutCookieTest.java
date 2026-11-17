package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.servlet.http.Cookie;
import me.yeonjae.tonebridge.adapter.in.web.dto.*;
import me.yeonjae.tonebridge.application.port.in.*;
import me.yeonjae.tonebridge.application.port.out.*;
import me.yeonjae.tonebridge.shared.config.*;
import me.yeonjae.tonebridge.shared.security.*;
import me.yeonjae.tonebridge.shared.exception.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.*;
import org.springframework.test.util.ReflectionTestUtils;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

@ExtendWith(MockitoExtension.class)
class LocalLogoutCookieTest {
    @Mock LoginWithGoogleUseCase google;
    @Mock RegisterLocalUserUseCase register;
    @Mock LoginLocalUseCase login;
    @Mock RefreshTokenUseCase refresh;
    @Mock RefreshTokenPort tokens;
    @Mock GoogleOAuthPort oauth;
    @Mock OAuthStatePort states;
    @Mock LoginRateLimiter limits;
    @Mock ClientIpResolver clientIp;
    @Spy ToneBridgeProperties properties = new ToneBridgeProperties();
    @Spy JwtProperties jwt = new JwtProperties();
    @InjectMocks AuthController controller;
    MockHttpServletRequest request;
    MockHttpServletResponse response;
    final TokenResponse result = new TokenResponse("access-fixture", "refresh-fixture");

    @BeforeEach void setup() {
        request = new MockHttpServletRequest(); response = new MockHttpServletResponse();
        request.setCookies(new Cookie("tonebridge_signed_out", "1"), new Cookie("refresh_token", "old-refresh"));
        ReflectionTestUtils.setField(controller, "secureCookie", true);
        ReflectionTestUtils.setField(controller, "sameSiteCookie", "Lax");
    }
    private void assertExplicitLoginCookies() {
        assertThat(response.getHeaders("Set-Cookie")).anySatisfy(cookie ->
                assertThat(cookie).startsWith("refresh_token=").contains("HttpOnly", "Secure", "Path=/api/auth"));
        assertThat(response.getHeaders("Set-Cookie")).anySatisfy(cookie ->
                assertThat(cookie).startsWith("tonebridge_signed_out=;").contains("Max-Age=0", "Path=/", "Secure", "SameSite=Lax"));
    }
    @Test void passwordLoginClearsLocalSignoutOnlyAfterSuccess() {
        when(login.loginLocal(anyString(), anyString())).thenReturn(result);
        controller.login(new LoginRequest("test@example.test", "Password1!"), request, response);
        assertExplicitLoginCookies();
    }
    @Test void registrationClearsLocalSignoutOnlyAfterSuccess() {
        when(register.register(anyString(), anyString(), anyString())).thenReturn(result);
        controller.register(new RegisterRequest("test@example.test", "tester", "Password1!"), request, response);
        assertExplicitLoginCookies();
    }
    @Test void validOAuthCallbackClearsLocalSignout() throws Exception {
        when(states.validateAndConsume("valid-state")).thenReturn(true);
        when(google.login(eq("code"), any())).thenReturn(result);
        controller.handleGoogleCallback("code", "valid-state", response);
        assertExplicitLoginCookies();
    }
    @Test void refreshCannotRemoveLocalSignout() {
        when(refresh.refresh("old-refresh")).thenReturn(result);
        controller.refresh(request, response);
        assertThat(response.getHeaders("Set-Cookie")).noneMatch(cookie -> cookie.startsWith("tonebridge_signed_out="));
        assertThat(response.getHeaders("Set-Cookie")).anyMatch(cookie -> cookie.startsWith("refresh_token="));
    }
    @Test void failedPasswordLoginKeepsLocalSignout() {
        when(login.loginLocal(anyString(), anyString())).thenThrow(new ToneBridgeException(ErrorCode.LOGIN_FAILED));
        assertThatThrownBy(() -> controller.login(new LoginRequest("test@example.test", "wrong"), request, response))
                .isInstanceOf(ToneBridgeException.class);
        assertThat(response.getHeaders("Set-Cookie")).isEmpty();
    }
    @Test void invalidOAuthStateKeepsLocalSignout() throws Exception {
        controller.handleGoogleCallback("code", "invalid-state", response);
        assertThat(response.getHeaders("Set-Cookie")).isEmpty();
        verifyNoInteractions(google);
    }
}
