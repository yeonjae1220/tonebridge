-- Study Cards & Learner Attempts

CREATE TABLE study_cards (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id        UUID         NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
    created_by_user_id UUID        NOT NULL REFERENCES users(id),
    phrase            VARCHAR(500) NOT NULL,
    context           TEXT,
    native_audio_url  VARCHAR(500),
    explanation       TEXT,
    tags              VARCHAR(500) NOT NULL DEFAULT '',
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_study_cards_session_id ON study_cards (session_id);

CREATE TABLE learner_attempts (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id         UUID         NOT NULL REFERENCES study_cards(id) ON DELETE CASCADE,
    learner_id      UUID         NOT NULL REFERENCES users(id),
    audio_url       VARCHAR(500) NOT NULL,
    correction_note TEXT,
    score           SMALLINT     CHECK (score BETWEEN 1 AND 5),
    attempted_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_learner_attempts_card_id   ON learner_attempts (card_id);
CREATE INDEX idx_learner_attempts_learner_id ON learner_attempts (learner_id);
