-- 로컬 이메일/비밀번호 인증 지원
-- 기존 회원은 모두 Google 가입자이므로 provider 기본값 = 'GOOGLE'
-- password_hash 는 LOCAL 회원만 채워지며 BCrypt 해시(60자) 저장

ALTER TABLE users
    ADD COLUMN password_hash VARCHAR(60),
    ADD COLUMN provider       VARCHAR(20) NOT NULL DEFAULT 'GOOGLE'
        CHECK (provider IN ('LOCAL', 'GOOGLE'));
