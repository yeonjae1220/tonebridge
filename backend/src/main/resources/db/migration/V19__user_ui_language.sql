ALTER TABLE users
    ADD COLUMN ui_language VARCHAR(30) NOT NULL DEFAULT 'ko';

UPDATE users
SET ui_language = native_language
WHERE native_language IN ('ko', 'en', 'ja', 'zh', 'es', 'fr', 'de', 'pt', 'ru');
