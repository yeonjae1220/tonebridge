package me.yeonjae.tonebridge.application.port.out;

/**
 * 비밀번호 단방향 해싱 포트. 구현은 어댑터 계층(BCrypt 등)에서 제공한다.
 */
public interface PasswordHasherPort {

    /** 평문 비밀번호를 해시한다. */
    String encode(String rawPassword);

    /** 평문 비밀번호가 저장된 해시와 일치하는지 검증한다. */
    boolean matches(String rawPassword, String hashedPassword);
}
