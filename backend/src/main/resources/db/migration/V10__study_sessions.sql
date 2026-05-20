-- Study Sessions

CREATE TABLE study_sessions (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    title      VARCHAR(200),
    created_by UUID         NOT NULL REFERENCES users(id),
    status     VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                   CHECK (status IN ('ACTIVE', 'ENDED')),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE session_members (
    session_id UUID        NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id),
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_id, user_id)
);

CREATE INDEX idx_session_members_user_id ON session_members (user_id);
