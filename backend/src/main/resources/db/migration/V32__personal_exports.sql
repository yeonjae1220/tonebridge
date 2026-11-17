CREATE TABLE personal_exports (
 id UUID PRIMARY KEY,
 owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
 include_audio BOOLEAN NOT NULL,
 state VARCHAR(16) NOT NULL CHECK(state IN ('QUEUED','RUNNING','READY','FAILED','EXPIRED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 started_at TIMESTAMPTZ,
 completed_at TIMESTAMPTZ,
 expires_at TIMESTAMPTZ,
 byte_size BIGINT,
 download_count INTEGER NOT NULL DEFAULT 0,
 access_checks JSONB,
 failure_code VARCHAR(40),
 artifact_deleted BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_personal_exports_owner ON personal_exports(owner_id,created_at DESC);
CREATE INDEX idx_personal_exports_pending ON personal_exports(state,created_at);
CREATE TABLE audio_upload_owners (
 audio_key VARCHAR(500) PRIMARY KEY,
 owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audio_upload_owners_owner ON audio_upload_owners(owner_id);
