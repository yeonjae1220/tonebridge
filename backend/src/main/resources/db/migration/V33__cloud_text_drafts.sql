CREATE TABLE cloud_draft_settings (
 owner_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 enabled BOOLEAN NOT NULL DEFAULT false,
 epoch UUID NOT NULL,
 version BIGINT NOT NULL DEFAULT 1
);
CREATE TABLE cloud_drafts (
 owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 id UUID NOT NULL,
 kind VARCHAR(16) NOT NULL CHECK(kind IN ('editor','feedback','card')),
 scope VARCHAR(150) NOT NULL,
 version BIGINT NOT NULL,
 state VARCHAR(16) NOT NULL CHECK(state IN ('ACTIVE','DELETED','EXPIRED','SUBMITTED')),
 value JSONB,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ,
 pending_operation UUID,
 pending_kind VARCHAR(16) CHECK(pending_kind IN ('COMPOSITION','SUBMISSION')),
 pending_payload JSONB,
 PRIMARY KEY(owner_id,id),
 CHECK(value IS NULL OR octet_length(value::text)<=200000),
 CHECK(pending_payload IS NULL OR octet_length(pending_payload::text)<=200000)
);
CREATE INDEX idx_cloud_drafts_expiry ON cloud_drafts(expires_at) WHERE state='ACTIVE';
CREATE UNIQUE INDEX idx_cloud_draft_pending ON cloud_drafts(owner_id,pending_kind,pending_operation) WHERE pending_operation IS NOT NULL;
CREATE TABLE cloud_draft_revisions (
 owner_id UUID NOT NULL,
 draft_id UUID NOT NULL,
 version BIGINT NOT NULL,
 value JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '7 days',
 PRIMARY KEY(owner_id,draft_id,version),
 FOREIGN KEY(owner_id,draft_id) REFERENCES cloud_drafts(owner_id,id) ON DELETE CASCADE
);
CREATE TABLE cloud_draft_operations (
 owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 operation_id UUID NOT NULL,
 fingerprint VARCHAR(64) NOT NULL,
 draft_id UUID,
 applied_version BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_id,operation_id)
);
CREATE INDEX idx_cloud_revisions_expiry ON cloud_draft_revisions(expires_at);
CREATE INDEX idx_cloud_operations_created ON cloud_draft_operations(created_at);
CREATE INDEX idx_cloud_operations_owner_created ON cloud_draft_operations(owner_id,created_at);
