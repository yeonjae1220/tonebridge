-- Short-lived pilot measurement, disabled until tonebridge.validation.enabled is set.
-- Account deletion removes identifiable activity; learning content is never copied here.
CREATE TABLE learning_activity (
    id UUID PRIMARY KEY,
    kind VARCHAR(32) NOT NULL CHECK (kind IN ('FRIEND_ACCEPTED', 'EXAMPLE_SAVED', 'PRACTICE_SAVED', 'FEEDBACK_SAVED')),
    actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    peer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID,
    card_id UUID,
    attempt_id UUID,
    occurred_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_learning_activity_time ON learning_activity(occurred_at);
CREATE INDEX idx_learning_activity_actor_time ON learning_activity(actor_id, occurred_at);
