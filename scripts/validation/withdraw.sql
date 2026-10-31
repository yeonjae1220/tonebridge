-- Operator-only, verified account; preview matching activity counts first using a read-only SELECT.
-- Stop collection and remove identifiable pilot events, including shared-session links.
-- Keep enrollment revoked until cleanup; aggregate diagnostics contain no account mapping.
\set ON_ERROR_STOP on
BEGIN;
UPDATE validation_participants SET revoked_at = COALESCE(revoked_at, statement_timestamp())
WHERE user_id = CAST(:'user_id' AS uuid);
DELETE FROM learning_activity
WHERE actor_id = CAST(:'user_id' AS uuid) OR peer_id = CAST(:'user_id' AS uuid)
   OR session_id IN (SELECT session_id FROM session_members WHERE user_id = CAST(:'user_id' AS uuid));
COMMIT;
