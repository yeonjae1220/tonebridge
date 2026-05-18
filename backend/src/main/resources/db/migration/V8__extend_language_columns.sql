-- Extend language columns to support variant codes (e.g. ko-KR-x-gyeong = 15 chars, zh-CN-x-northeast = 18 chars)
ALTER TABLE users ALTER COLUMN native_language TYPE VARCHAR(30);

-- Widen target_language on correction_requests for consistency (clients may submit variant codes)
ALTER TABLE correction_requests ALTER COLUMN target_language TYPE VARCHAR(30);

-- Add optional dialect/variant preference on correction requests
ALTER TABLE correction_requests ADD COLUMN target_variant VARCHAR(30);

CREATE INDEX idx_correction_requests_target_variant ON correction_requests (target_variant);
