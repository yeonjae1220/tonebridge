CREATE TABLE card_native_audio (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id    UUID        NOT NULL REFERENCES study_cards (id) ON DELETE CASCADE,
    audio_key  TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_card_native_audio_card_id ON card_native_audio (card_id);
