-- Add dialect / regional variant columns to the users table.
-- native_dialect        : single variant code for the user's native language (nullable = 표준어).
-- fluent_lang_variants  : JSON map of { languageCode -> variantCode } for fluent languages.
-- learning_lang_variants: JSON map of { languageCode -> variantCode } for learning languages.
ALTER TABLE users
    ADD COLUMN native_dialect          VARCHAR(30),
    ADD COLUMN fluent_lang_variants    TEXT,
    ADD COLUMN learning_lang_variants  TEXT;
