package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.adapter.in.web.dto.TokenResponse;

/**
 * 이메일/비밀번호 로컬 회원가입 유스케이스.
 * 성공 시 즉시 로그인 처리되어 토큰을 발급한다.
 */
public interface RegisterLocalUserUseCase {
    TokenResponse register(String email, String username, String rawPassword);
}
