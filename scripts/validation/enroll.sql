-- Operator-only, after participant acknowledgement; never store these arguments in Git/CI logs.
-- Variables: user_id, notice_version, acknowledged_at, starts_at, ends_at (UTC ISO 8601).
-- One finite enrollment per account; duplicate registration fails rather than silently extending consent.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO validation_participants (user_id, notice_version, acknowledged_at, starts_at, ends_at)
VALUES (CAST(:'user_id' AS uuid), :'notice_version', CAST(:'acknowledged_at' AS timestamptz),
        CAST(:'starts_at' AS timestamptz), CAST(:'ends_at' AS timestamptz));
COMMIT;
