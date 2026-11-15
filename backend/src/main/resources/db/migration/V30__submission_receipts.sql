-- Keep successful identities and cancellation tombstones: late retries must never recreate records.
CREATE TABLE submission_receipts (
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operation_id UUID NOT NULL,
    kind VARCHAR(20),
    fingerprint VARCHAR(64),
    resource_id UUID,
    cancelled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (owner_id, operation_id),
    CHECK (kind IS NULL OR kind IN ('CORRECTION', 'CARD')),
    CHECK ((cancelled AND resource_id IS NULL) OR
           (NOT cancelled AND kind IS NOT NULL AND fingerprint IS NOT NULL AND resource_id IS NOT NULL))
);
