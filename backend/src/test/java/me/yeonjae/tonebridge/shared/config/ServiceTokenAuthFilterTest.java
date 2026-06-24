package me.yeonjae.tonebridge.shared.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.PrintWriter;
import java.io.StringWriter;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ServiceTokenAuthFilterTest {

    private static final String HEADER = "X-Internal-Token";
    private static final String TOKEN = "s3cret-internal-token";

    private final HttpServletRequest request = mock(HttpServletRequest.class);
    private final HttpServletResponse response = mock(HttpServletResponse.class);
    private final FilterChain chain = mock(FilterChain.class);

    private void stubWriter() throws Exception {
        when(response.getWriter()).thenReturn(new PrintWriter(new StringWriter()));
    }

    @Test
    @DisplayName("올바른 토큰이면 필터 체인을 통과시킨다")
    void passesWithCorrectToken() throws Exception {
        when(request.getHeader(HEADER)).thenReturn(TOKEN);

        new ServiceTokenAuthFilter(TOKEN).doFilterInternal(request, response, chain);

        verify(chain).doFilter(request, response);
        verify(response, never()).setStatus(anyInt());
    }

    @Test
    @DisplayName("토큰 헤더가 없으면 401, 체인 미통과")
    void rejectsWhenHeaderMissing() throws Exception {
        stubWriter();
        when(request.getHeader(HEADER)).thenReturn(null);

        new ServiceTokenAuthFilter(TOKEN).doFilterInternal(request, response, chain);

        verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    @DisplayName("틀린 토큰이면 401, 체인 미통과")
    void rejectsWhenTokenWrong() throws Exception {
        stubWriter();
        when(request.getHeader(HEADER)).thenReturn("wrong-token");

        new ServiceTokenAuthFilter(TOKEN).doFilterInternal(request, response, chain);

        verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    @DisplayName("토큰 미설정(빈 값)이면 모든 요청 차단 — fail-closed")
    void rejectsWhenNotConfigured() throws Exception {
        stubWriter();
        when(request.getHeader(HEADER)).thenReturn("anything");

        new ServiceTokenAuthFilter("").doFilterInternal(request, response, chain);

        verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        verify(chain, never()).doFilter(any(), any());
    }
}
