-- ToneBridge 초기 스키마

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email                VARCHAR(255) UNIQUE NOT NULL,
    username             VARCHAR(50)  UNIQUE NOT NULL,
    native_language      VARCHAR(10)  NOT NULL,
    fluent_languages     VARCHAR(1024) NOT NULL DEFAULT '',
    learning_languages   VARCHAR(1024) NOT NULL DEFAULT '',
    credits              INTEGER      NOT NULL DEFAULT 30 CHECK (credits >= 0),
    reputation_score     NUMERIC(4,2) NOT NULL DEFAULT 5.00,
    corrector_level      VARCHAR(20)  NOT NULL DEFAULT 'NATIVE'
                             CHECK (corrector_level IN ('NATIVE', 'VERIFIED_CORRECTOR', 'EXPERT_COACH')),
    correction_streak    INTEGER      NOT NULL DEFAULT 0,
    last_correction_date DATE,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);

-- ── Correction Requests ───────────────────────────────────────────────────────
CREATE TABLE correction_requests (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id    UUID         NOT NULL REFERENCES users(id),
    type            VARCHAR(10)  NOT NULL CHECK (type IN ('TEXT', 'AUDIO')),
    content_text    TEXT,
    audio_url       VARCHAR(500),
    target_language VARCHAR(10)  NOT NULL,
    context         TEXT,
    feedback_goals  VARCHAR(512) NOT NULL DEFAULT '',
    credit_cost     INTEGER      NOT NULL CHECK (credit_cost > 0),
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'AI_COMPLETED')),
    ai_correction   TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW() + INTERVAL '48 hours',
    CONSTRAINT chk_content CHECK (
        (type = 'TEXT' AND content_text IS NOT NULL) OR
        (type = 'AUDIO' AND audio_url IS NOT NULL)
    )
);

CREATE INDEX idx_correction_requests_status          ON correction_requests (status);
CREATE INDEX idx_correction_requests_target_language ON correction_requests (target_language);
CREATE INDEX idx_correction_requests_requester       ON correction_requests (requester_id);

-- ── Corrections ───────────────────────────────────────────────────────────────
CREATE TABLE corrections (
    id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id            UUID         NOT NULL REFERENCES correction_requests(id),
    corrector_id          UUID         REFERENCES users(id),
    is_ai                 BOOLEAN      NOT NULL DEFAULT FALSE,
    corrected_text        TEXT,
    explanation           TEXT,
    tags                  VARCHAR(512) NOT NULL DEFAULT '',
    timestamp_comments    TEXT,
    pronunciation_score   SMALLINT     CHECK (pronunciation_score BETWEEN 1 AND 10),
    intonation_score      SMALLINT     CHECK (intonation_score BETWEEN 1 AND 10),
    fluency_score         SMALLINT     CHECK (fluency_score BETWEEN 1 AND 10),
    reference_audio_url   VARCHAR(500),
    credit_earned         INTEGER      NOT NULL DEFAULT 0 CHECK (credit_earned >= 0),
    status                VARCHAR(20)  NOT NULL DEFAULT 'SUBMITTED'
                              CHECK (status IN ('SUBMITTED', 'APPROVED', 'REJECTED')),
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_corrections_request_id   ON corrections (request_id);
CREATE INDEX idx_corrections_corrector_id ON corrections (corrector_id);

-- ── Credit Transactions ───────────────────────────────────────────────────────
CREATE TABLE credit_transactions (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID         NOT NULL REFERENCES users(id),
    amount       INTEGER      NOT NULL,
    type         VARCHAR(20)  NOT NULL
                     CHECK (type IN ('EARN', 'SPEND', 'BONUS', 'PENALTY', 'SIGNUP')),
    reference_id UUID,
    note         VARCHAR(255),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_transactions_user_id ON credit_transactions (user_id);

-- ── Ratings ───────────────────────────────────────────────────────────────────
CREATE TABLE ratings (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    correction_id UUID        NOT NULL UNIQUE REFERENCES corrections(id),
    rater_id      UUID        NOT NULL REFERENCES users(id),
    helpful       BOOLEAN     NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
