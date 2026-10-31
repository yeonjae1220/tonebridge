-- Version 26.1 precedes the independent pilot V27; either branch can merge without renumbering.
-- Historical feedback has no reliable author/time; leave these values null.
ALTER TABLE learner_attempts ADD COLUMN correction_author_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE learner_attempts ADD COLUMN correction_updated_at TIMESTAMPTZ;
CREATE INDEX idx_attempts_feedback_learner ON learner_attempts
    (learner_id, (COALESCE(correction_updated_at, attempted_at)) DESC, id DESC)
    WHERE correction_note IS NOT NULL;
