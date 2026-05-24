-- Enforce a practical upper bound on the JSON columns that store language
-- variant maps (Map<String,String>).  The domain layer caps each map at
-- 20 entries with keys/values of max 30 characters each, so the worst-case
-- serialised size is well under 2 048 bytes.
-- Using VARCHAR instead of unbounded TEXT also allows the DB engine to
-- reject obviously corrupt payloads before they reach the application.

ALTER TABLE users
    ALTER COLUMN fluent_lang_variants TYPE VARCHAR(2048),
    ALTER COLUMN learning_lang_variants TYPE VARCHAR(2048);
