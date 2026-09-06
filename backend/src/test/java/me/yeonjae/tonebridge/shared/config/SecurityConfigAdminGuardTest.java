package me.yeonjae.tonebridge.shared.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.withSettings;

/**
 * {@code SecurityConfig#validateAdminCredentials()} 의 분기를 고정한다 (GLOBAL-PIT-006).
 *
 * <p>이 가드는 지금까지 CI 에서 <b>단 한 번도 실행된 적이 없었다</b> — 모든 테스트가
 * {@code test} 프로파일로 돌고 가드 첫 줄이 {@code test} 면 즉시 return 하기 때문이다.
 * 조건식이 통째로 망가져도 빌드는 초록이었다. 그래서 여기서는 프로파일을 직접 주입해
 * 운영 경로를 부른다.
 *
 * <p>스프링 컨텍스트를 띄우지 않는다. 가드가 읽는 것은 {@code environment}·{@code adminEmail}·
 * {@code adminPasswordBcrypt} 셋뿐이라 그 셋만 채운다 — 무관한 생성자 의존성이 늘어도
 * 이 테스트는 깨지지 않는다.
 *
 * <p>🔴 같은 가드가 Ovlo·SnapGuide·TimeManager·ToneBridge <b>네 벌</b> 있다. 한 벌만 고치면
 * 나머지가 조용히 남는다 (GLOBAL-PIT-132) — 조건을 바꿀 땐 네 레포를 함께 본다.
 */
class SecurityConfigAdminGuardTest {

    /** 형식상 유효한 BCrypt 해시 — 접두 {@code $2a$} + 비용 {@code 10$} + 53자 = 정확히 60자. */
    private static final String VALID_HASH = "$2a$10$" + "x".repeat(53);
    private static final String VALID_EMAIL = "admin@mungji.com";

    /** 실제로 공개돼 있어 운영에서 쓰면 안 되는 해시 (SecurityConfig.KNOWN_TEST_HASHES). */
    private static final String KNOWN_TEST_HASH =
            "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.";

    private void validate(String activeProfile, String email, String bcrypt) {
        SecurityConfig config =
                mock(SecurityConfig.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));
        Environment environment = mock(Environment.class);
        when(environment.getActiveProfiles()).thenReturn(new String[]{activeProfile});

        ReflectionTestUtils.setField(config, "environment", environment);
        ReflectionTestUtils.setField(config, "adminEmail", email);
        ReflectionTestUtils.setField(config, "adminPasswordBcrypt", bcrypt);

        config.validateAdminCredentials();
    }

    @Test
    @DisplayName("test 프로파일이면 값이 무엇이든 통과한다 — 이 가드가 CI 에서 실행되지 않던 이유")
    void skipsEntirelyUnderTestProfile() {
        assertThatCode(() -> validate("test", "", "placeholder")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("운영 프로파일 + 정상 자격증명이면 통과한다")
    void passesWithValidCredentials() {
        assertThatCode(() -> validate("prod", VALID_EMAIL, VALID_HASH)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("ADMIN_EMAIL 이 빈 문자열이면 막는다 — 시크릿 빈값 주입(GLOBAL-PIT-160) 경로")
    void rejectsBlankEmail() {
        assertThatThrownBy(() -> validate("prod", "", VALID_HASH))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ADMIN_EMAIL 환경변수가 설정되지 않았습니다");
    }

    @Test
    @DisplayName("ADMIN_EMAIL 이 null 이면 막는다")
    void rejectsNullEmail() {
        assertThatThrownBy(() -> validate("prod", null, VALID_HASH))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ADMIN_EMAIL 환경변수가 설정되지 않았습니다");
    }

    @Test
    @DisplayName("ADMIN_EMAIL 이 기본값 도메인(.local/.example.com)이면 막는다")
    void rejectsPlaceholderEmailDomain() {
        assertThatThrownBy(() -> validate("prod", "admin@app.local", VALID_HASH))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ADMIN_EMAIL 기본값이");
        assertThatThrownBy(() -> validate("prod", "admin@mail.example.com", VALID_HASH))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ADMIN_EMAIL 기본값이");
    }

    @Test
    @DisplayName("ADMIN_PASSWORD_BCRYPT 가 null 이면 막는다")
    void rejectsNullBcrypt() {
        assertThatThrownBy(() -> validate("prod", VALID_EMAIL, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("유효한 BCrypt 해시가 아닙니다");
    }

    @Test
    @DisplayName("ADMIN_PASSWORD_BCRYPT 가 빈 문자열이면 '형식' 분기로 막힌다 — 추론이 아니라 실측")
    void rejectsBlankBcryptViaFormatBranch() {
        assertThatThrownBy(() -> validate("prod", VALID_EMAIL, ""))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("유효한 BCrypt 해시가 아닙니다");
    }

    @Test
    @DisplayName("길이·접두가 맞아도 'placeholder' 를 포함하면 막는다")
    void rejectsPlaceholderBcrypt() {
        String placeholder = "$2a$10$" + "placeholder" + "y".repeat(42);
        assertThat(placeholder).hasSize(60);
        assertThatThrownBy(() -> validate("prod", VALID_EMAIL, placeholder))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("유효한 BCrypt 해시가 아닙니다");
    }

    @Test
    @DisplayName("길이 경계 — 60자는 통과하고 59자는 막힌다")
    void rejectsHashShorterThanSixty() {
        assertThat(VALID_HASH).hasSize(60);
        assertThatCode(() -> validate("prod", VALID_EMAIL, VALID_HASH)).doesNotThrowAnyException();

        String fiftyNine = "$2a$10$" + "x".repeat(52);
        assertThat(fiftyNine).hasSize(59);
        assertThatThrownBy(() -> validate("prod", VALID_EMAIL, fiftyNine))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("유효한 BCrypt 해시가 아닙니다");
    }

    @Test
    @DisplayName("BCrypt 접두는 $2a$/$2b$/$2y$ 만 통과하고 그 밖($2c$)은 막힌다")
    void acceptsOnlyKnownBcryptPrefixes() {
        for (String prefix : new String[]{"$2a$", "$2b$", "$2y$"}) {
            String hash = prefix + "10$" + "x".repeat(53);
            assertThatCode(() -> validate("prod", VALID_EMAIL, hash)).doesNotThrowAnyException();
        }
        assertThatThrownBy(() -> validate("prod", VALID_EMAIL, "$2c$10$" + "x".repeat(53)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("유효한 BCrypt 해시가 아닙니다");
    }

    @Test
    @DisplayName("공개된 테스트 해시는 형식이 완벽해도 별도 분기로 막는다")
    void rejectsKnownPublicTestHash() {
        assertThat(KNOWN_TEST_HASH).hasSize(60);
        assertThatThrownBy(() -> validate("prod", VALID_EMAIL, KNOWN_TEST_HASH))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("공개된 테스트 해시입니다");
    }
}
