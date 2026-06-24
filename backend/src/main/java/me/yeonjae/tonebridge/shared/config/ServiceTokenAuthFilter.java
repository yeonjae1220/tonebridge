package me.yeonjae.tonebridge.shared.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Gates {@code /api/internal/**} with a shared service token, compared in
 * constant time. Used only by the lab.mungji console aggregator for read-only
 * count summaries. Fails closed: when the token is unset the filter denies every
 * request, so the endpoint is inert until the secret is provisioned.
 */
public class ServiceTokenAuthFilter extends OncePerRequestFilter {

    private static final String HEADER = "X-Internal-Token";

    private final String expectedToken;

    public ServiceTokenAuthFilter(String expectedToken) {
        this.expectedToken = expectedToken;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (!tokenValid(request.getHeader(HEADER))) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"unauthorized\"}");
            return;
        }
        filterChain.doFilter(request, response);
    }

    private boolean tokenValid(String provided) {
        if (expectedToken == null || expectedToken.isBlank() || provided == null) {
            return false;
        }
        return MessageDigest.isEqual(
                provided.getBytes(StandardCharsets.UTF_8),
                expectedToken.getBytes(StandardCharsets.UTF_8));
    }
}
