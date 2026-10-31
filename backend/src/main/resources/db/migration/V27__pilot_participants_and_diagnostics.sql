-- No account is opted in by this migration. Operator registration requires prior notice.
CREATE TABLE validation_participants (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    notice_version VARCHAR(64) NOT NULL CHECK (length(trim(notice_version)) > 0),
    acknowledged_at TIMESTAMPTZ NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (acknowledged_at <= starts_at),
    CHECK (ends_at > starts_at AND ends_at <= starts_at + interval '30 days')
);

-- A maximum of seven rows per UTC day. No user, session, URL or raw event payload.
CREATE TABLE validation_diagnostic_daily (
    day DATE NOT NULL,
    event VARCHAR(32) NOT NULL CHECK (event IN (
        'RECORDING_ATTEMPT', 'RECORDING_SUCCEEDED', 'RECORDING_FAILED', 'MICROPHONE_DENIED',
        'UPLOAD_ATTEMPT', 'UPLOAD_SUCCEEDED', 'UPLOAD_FAILED')),
    total BIGINT NOT NULL CHECK (total > 0),
    PRIMARY KEY (day, event)
);
