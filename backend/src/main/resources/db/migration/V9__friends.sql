-- Friend Requests

CREATE TABLE friend_requests (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id   UUID        NOT NULL REFERENCES users(id),
    receiver_id UUID        NOT NULL REFERENCES users(id),
    status      VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'ACCEPTED', 'BLOCKED')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_friend_request UNIQUE (sender_id, receiver_id),
    CONSTRAINT chk_no_self_request CHECK (sender_id <> receiver_id)
);

CREATE INDEX idx_friend_requests_sender   ON friend_requests (sender_id);
CREATE INDEX idx_friend_requests_receiver ON friend_requests (receiver_id);
