-- 피드 조회(GET /api/correction-requests/feed/page) 전용 부분 인덱스.
-- 피드는 PENDING·미삭제 요청만 언어로 걸러 최신순으로 읽는다. 전체 요청 중 이 부분만 담아
-- 완료된 요청이 쌓여도 인덱스가 커지지 않게 한다.
CREATE INDEX idx_correction_requests_feed
    ON correction_requests (target_language, created_at DESC, id DESC)
    WHERE status = 'PENDING' AND deleted_at IS NULL;
