CREATE TABLE fcm_tokens (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT        NOT NULL,
    platform   VARCHAR(10) NOT NULL CHECK (platform IN ('IOS', 'ANDROID')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 유저당 단일 활성 토큰 (멀티 디바이스 시 (user_id, token) 유니크로 변경)
CREATE UNIQUE INDEX idx_fcm_tokens_user_id ON fcm_tokens (user_id);
CREATE INDEX idx_fcm_tokens_token ON fcm_tokens (token);
