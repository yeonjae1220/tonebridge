-- Audio objects left behind by a deleted account. Database rows cascade with the user,
-- but the files live in object storage, so a worker deletes them from here and retries
-- until storage confirms. Keys only: nothing here identifies the deleted user.
CREATE TABLE account_audio_deletions (
    audio_key       VARCHAR(500) PRIMARY KEY,
    queued_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    attempts        INTEGER      NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_account_audio_deletions_due ON account_audio_deletions (next_attempt_at);
