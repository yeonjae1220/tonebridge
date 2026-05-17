-- ── User Badges ───────────────────────────────────────────────────────────────
CREATE TABLE user_badges (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID         NOT NULL REFERENCES users(id),
    badge_type VARCHAR(30)  NOT NULL
                    CHECK (badge_type IN ('STREAK_7DAY', 'FAST_RESPONDER', 'AUDIO_EXPERT')),
    awarded_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_badge UNIQUE (user_id, badge_type)
);

CREATE INDEX idx_user_badges_user_id ON user_badges (user_id);
