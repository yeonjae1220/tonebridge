-- Reports of objectionable users or content (App Store guideline 1.2). The operator reviews
-- open reports in /admin/reports; the terms promise a review within 24 hours.
-- reported_user_id is resolved by the server from the target, never taken from the client.
CREATE TABLE content_reports (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id      UUID         REFERENCES users(id) ON DELETE SET NULL,
    target_type      VARCHAR(30)  NOT NULL CHECK (target_type IN
                         ('USER', 'CARD', 'NATIVE_AUDIO', 'ATTEMPT_FEEDBACK', 'CORRECTION_REQUEST', 'CORRECTION')),
    target_id        UUID         NOT NULL,
    reported_user_id UUID         REFERENCES users(id) ON DELETE SET NULL,
    reason           VARCHAR(20)  NOT NULL CHECK (reason IN
                         ('SPAM', 'HARASSMENT', 'HATE', 'SEXUAL', 'VIOLENCE', 'ILLEGAL', 'OTHER')),
    detail           VARCHAR(500),
    status           VARCHAR(20)  NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'DISMISSED', 'ACTIONED')),
    resolution       VARCHAR(30),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    resolved_at      TIMESTAMPTZ
);

-- One open report per reporter and target: repeating a report is idempotent.
CREATE UNIQUE INDEX uq_content_reports_open
    ON content_reports (reporter_id, target_type, target_id) WHERE status = 'OPEN';
CREATE INDEX idx_content_reports_open ON content_reports (created_at) WHERE status = 'OPEN';
CREATE INDEX idx_content_reports_reporter ON content_reports (reporter_id, created_at);
