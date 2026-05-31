package me.yeonjae.tonebridge.shared.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Slf4j
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final CorsProperties corsProperties;
    private final Environment environment;

    /** prod 프로파일에서 true — Swagger 차단 */
    private boolean isProd() {
        for (String p : environment.getActiveProfiles()) {
            if (p.equalsIgnoreCase("prod")) return true;
        }
        return false;
    }

    // Admin 계정 — k8s Secret에서 주입 (LOCAL provider 유저와 완전 분리)
    @Value("${admin.email}")
    private String adminEmail;

    /** BCrypt hash — k8s Secret ADMIN_PASSWORD_BCRYPT 에서 주입 */
    @Value("${admin.password.bcrypt}")
    private String adminPasswordBcrypt;

    private static final java.util.Set<String> KNOWN_TEST_HASHES = java.util.Set.of(
            "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi."
    );

    /**
     * CRITICAL fix: 애플리케이션 시작 시 BCrypt 해시 유효성 검증.
     * 환경변수 미설정(placeholder 값)인 채로 프로덕션 배포되는 것을 방지.
     */
    @PostConstruct
    public void validateAdminCredentials() {
        if (adminEmail == null || adminEmail.isBlank()) {
            throw new IllegalStateException(
                    "[Admin] ADMIN_EMAIL 환경변수가 설정되지 않았습니다.");
        }
        if (adminEmail.endsWith(".local") || adminEmail.endsWith(".example.com")) {
            throw new IllegalStateException(
                    "[Admin] ADMIN_EMAIL 기본값이 운영 환경에서 사용되었습니다. ADMIN_EMAIL을 실제 값으로 설정하세요.");
        }
        if (adminPasswordBcrypt == null
                || adminPasswordBcrypt.contains("placeholder")
                || adminPasswordBcrypt.length() < 60
                || (!adminPasswordBcrypt.startsWith("$2a$")
                    && !adminPasswordBcrypt.startsWith("$2b$")
                    && !adminPasswordBcrypt.startsWith("$2y$"))) {
            throw new IllegalStateException(
                    "[Admin] ADMIN_PASSWORD_BCRYPT가 유효한 BCrypt 해시가 아닙니다. " +
                    "다음 명령으로 생성: htpasswd -bnBC 10 '' 'password' | tr -d ':\\n' | sed 's/$2y/$2a/'");
        }
        if (KNOWN_TEST_HASHES.contains(adminPasswordBcrypt)) {
            throw new IllegalStateException(
                    "[Admin] ADMIN_PASSWORD_BCRYPT가 공개된 테스트 해시입니다. 운영 환경에서 사용할 수 없습니다.");
        }
        log.info("[Admin] admin 계정 설정이 유효합니다: email={}", adminEmail);
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public UserDetailsService adminUserDetailsService() {
        var admin = User.builder()
                .username(adminEmail)
                .password(adminPasswordBcrypt)  // 이미 해시된 값
                .roles("ADMIN")
                .build();
        return new InMemoryUserDetailsManager(admin);
    }

    @Bean
    public AuthenticationManager adminAuthenticationManager() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(adminUserDetailsService());
        provider.setPasswordEncoder(passwordEncoder());
        return new ProviderManager(provider);
    }

    /**
     * Admin 전용 Security chain (세션 기반).
     * /admin/** 경로만 담당. formLogin + httpOnly 세션 쿠키로 인증.
     * JWT 필터 미적용 — Firebase/JWT 인증과 완전 분리.
     */
    @Bean
    @Order(1)
    public SecurityFilterChain adminFilterChain(HttpSecurity http) throws Exception {
        return http
                .securityMatcher("/admin/**")
                .authenticationManager(adminAuthenticationManager())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/admin/login").permitAll()
                        .anyRequest().hasRole("ADMIN")
                )
                .formLogin(form -> form
                        .loginPage("/admin/login")
                        .loginProcessingUrl("/admin/login")
                        .defaultSuccessUrl("/admin/dashboard", true)
                        .failureUrl("/admin/login?error")
                        .permitAll()
                )
                .logout(logout -> logout
                        .logoutUrl("/admin/logout")
                        .logoutSuccessUrl("/admin/login?logout")
                        .invalidateHttpSession(true)
                        .deleteCookies("JSESSIONID")
                )
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
                        .maximumSessions(1)
                )
                .csrf(Customizer.withDefaults())
                .headers(headers -> headers
                        .contentSecurityPolicy(csp -> csp.policyDirectives(
                                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'"))
                        .frameOptions(f -> f.deny())
                )
                .build();
    }

    @Bean
    @Order(2)
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .headers(headers -> headers
                        .contentTypeOptions(Customizer.withDefaults())
                        .frameOptions(f -> f.deny())
                        .httpStrictTransportSecurity(hsts -> hsts  // WARN fix: HSTS 추가
                                .maxAgeInSeconds(31536000)
                                .includeSubDomains(true))
                )
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/languages/variants").permitAll()
                        // T2 fix: Swagger는 prod 프로파일에서 차단
                        .requestMatchers("/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**", "/webjars/**")
                            .access((auth2, ctx) -> new org.springframework.security.authorization.AuthorizationDecision(!isProd()))
                        .requestMatchers("/actuator/health").permitAll()
                        .requestMatchers("/actuator/**").hasRole("ADMIN") // WARN fix: 나머지 actuator는 ADMIN 전용
                        .requestMatchers("/h2-console/**").access(
                                (authReq, ctx) -> {
                                    String remoteAddr = ctx.getRequest().getRemoteAddr();
                                    boolean isLocal = "127.0.0.1".equals(remoteAddr)
                                            || "0:0:0:0:0:0:0:1".equals(remoteAddr)
                                            || "::1".equals(remoteAddr);
                                    return new org.springframework.security.authorization.AuthorizationDecision(isLocal);
                                }
                        )
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated()
                )
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    /**
     * JwtAuthenticationFilter를 서블릿 필터로 자동 등록하지 않도록 막는다.
     * /admin/** 요청에 JWT 필터가 끼어들지 않게 하기 위함.
     */
    @Bean
    public FilterRegistrationBean<JwtAuthenticationFilter> jwtFilterRegistration() {
        FilterRegistrationBean<JwtAuthenticationFilter> reg =
                new FilterRegistrationBean<>(jwtAuthenticationFilter);
        reg.setEnabled(false);
        return reg;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(corsProperties.getAllowedOrigins().split(",")));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "X-Requested-With"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
