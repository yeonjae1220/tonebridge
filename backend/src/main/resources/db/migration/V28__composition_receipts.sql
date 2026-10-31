-- Durable, account-scoped receipts. Never expire successful identities: a late
-- retry must not recreate a deleted or previously completed composition.
CREATE TABLE composition_receipts (
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operation_id UUID NOT NULL,
    fingerprint VARCHAR(64),
    audio_key VARCHAR(500),
    content_type VARCHAR(50),
    session_id UUID,
    card_id UUID,
    request_id UUID,
    cancelled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (owner_id, operation_id)
);
