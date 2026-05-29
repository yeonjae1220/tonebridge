-- correction_requests: 채택된 교정 참조
ALTER TABLE correction_requests
    ADD COLUMN accepted_correction_id UUID REFERENCES corrections(id);

-- correction_likes: 교정 좋아요 (동시성 안전: DB 레벨 UNIQUE 제약)
CREATE TABLE correction_likes (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    correction_id UUID      NOT NULL REFERENCES corrections(id),
    user_id     UUID        NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_correction_like UNIQUE (correction_id, user_id)
);

CREATE INDEX idx_correction_likes_correction_id ON correction_likes(correction_id);
CREATE INDEX idx_correction_likes_user_id ON correction_likes(user_id);
