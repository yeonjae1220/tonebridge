package me.yeonjae.tonebridge.adapter.out.security;

import me.yeonjae.tonebridge.application.port.out.PasswordHasherPort;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * BCrypt 기반 비밀번호 해싱 어댑터.
 * SecurityConfig 의 PasswordEncoder 빈(admin 인증용)과 독립된 인스턴스를 사용한다 —
 * 두 관심사(회원 비밀번호 / admin 자격증명)를 분리하기 위함.
 */
@Component
public class BCryptPasswordHasherAdapter implements PasswordHasherPort {

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    @Override
    public String encode(String rawPassword) {
        return encoder.encode(rawPassword);
    }

    @Override
    public boolean matches(String rawPassword, String hashedPassword) {
        return encoder.matches(rawPassword, hashedPassword);
    }
}
