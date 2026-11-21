-- Sounds a friend points at when giving feedback on a practice attempt. Each row names one guide
-- from the reviewed pronunciation-guide catalogue (validated against an allow-list in the backend,
-- mirrored by frontend/src/lib/soundGuideIds.json). At most three per attempt, kept in display order.
CREATE TABLE attempt_sound_targets (
    attempt_id  UUID        NOT NULL REFERENCES learner_attempts(id) ON DELETE CASCADE,
    guide_id    VARCHAR(40) NOT NULL,
    position    INTEGER     NOT NULL CHECK (position BETWEEN 0 AND 2),
    created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (attempt_id, guide_id),
    UNIQUE (attempt_id, position)
);
