-- Study sessions no longer have an ended lifecycle in the product.
-- Keep the status column for API compatibility, but normalize legacy data.
UPDATE study_sessions
SET status = 'ACTIVE'
WHERE status = 'ENDED';
