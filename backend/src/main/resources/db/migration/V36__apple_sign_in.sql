-- Sign in with Apple (App Store guideline 4.8).
-- Apple identifies a user by a stable `sub`; the email claim can be a private relay address
-- and is not guaranteed on every sign-in, so the sub is the lookup key.
-- Kept in its own table instead of a users column: UserEntity is rebuilt from the domain
-- record on save, and a column it does not map would be easy to wipe by accident.

ALTER TABLE users DROP CONSTRAINT users_provider_check;
ALTER TABLE users ADD CONSTRAINT users_provider_check
    CHECK (provider IN ('LOCAL', 'GOOGLE', 'APPLE'));

CREATE TABLE user_apple_identities (
    apple_sub  VARCHAR(255) PRIMARY KEY,
    user_id    UUID         NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
