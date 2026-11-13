ALTER TABLE users ADD COLUMN credentials_version BIGINT NOT NULL DEFAULT 0;
CREATE TABLE password_reset_tokens (
    token_hash CHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credentials_version BIGINT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_password_reset_user ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_expiry ON password_reset_tokens(expires_at);
