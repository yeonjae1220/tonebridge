package me.yeonjae.tonebridge.domain.user;

/**
 * 회원 인증 제공자.
 * LOCAL  — 이메일/비밀번호로 직접 가입 (password_hash 보유)
 * GOOGLE — Google OAuth 가입 (password_hash 없음)
 */
public enum OAuthProvider {
    LOCAL,
    GOOGLE
}
