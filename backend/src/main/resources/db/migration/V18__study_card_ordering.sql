ALTER TABLE study_cards
    ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at DESC) - 1 AS rn
    FROM study_cards
)
UPDATE study_cards c
SET display_order = ranked.rn
FROM ranked
WHERE c.id = ranked.id;

CREATE INDEX idx_study_cards_session_order
    ON study_cards (session_id, display_order)
    WHERE deleted_at IS NULL;
