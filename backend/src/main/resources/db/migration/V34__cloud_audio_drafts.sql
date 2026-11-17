ALTER TABLE cloud_draft_settings ADD COLUMN audio_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE cloud_draft_settings ADD CONSTRAINT cloud_audio_consent CHECK (NOT audio_enabled OR enabled);
ALTER TABLE cloud_drafts DROP CONSTRAINT cloud_drafts_kind_check;
ALTER TABLE cloud_drafts ADD CONSTRAINT cloud_drafts_kind_check CHECK(kind IN ('editor','feedback','card','recording'));
DROP INDEX idx_cloud_draft_pending;
CREATE INDEX idx_cloud_draft_pending ON cloud_drafts(owner_id,pending_kind,pending_operation) WHERE pending_operation IS NOT NULL;
ALTER TABLE submission_receipts DROP CONSTRAINT submission_receipts_kind_check;
ALTER TABLE submission_receipts ADD CONSTRAINT submission_receipts_kind_check CHECK(kind IS NULL OR kind IN ('CORRECTION','CARD','PRACTICE','EXAMPLE'));
CREATE TABLE cloud_audio_assets (
 id UUID PRIMARY KEY,
 owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
 epoch UUID NOT NULL,
 draft_id UUID NOT NULL,
 byte_size BIGINT NOT NULL CHECK(byte_size>0 AND byte_size<=52428800),
 content_type VARCHAR(40) NOT NULL,
 sha256 VARCHAR(64) NOT NULL,
 object_key VARCHAR(200) NOT NULL,
 state VARCHAR(16) NOT NULL CHECK(state IN ('RESERVED','UPLOADING','READY','DELETING','DELETED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '15 minutes',
 lease_until TIMESTAMPTZ,
 cleanup_after TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cloud_audio_owner ON cloud_audio_assets(owner_id,created_at);
CREATE INDEX idx_cloud_audio_cleanup ON cloud_audio_assets(state,cleanup_after);
