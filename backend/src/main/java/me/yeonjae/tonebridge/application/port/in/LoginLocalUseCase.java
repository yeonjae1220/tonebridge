package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.adapter.in.web.dto.TokenResponse;

/**
 * 이메일/비밀번호 로컬 로그인 유스케이스.
 */
public interface LoginLocalUseCase {
    TokenResponse loginLocal(String email, String rawPassword);
}
