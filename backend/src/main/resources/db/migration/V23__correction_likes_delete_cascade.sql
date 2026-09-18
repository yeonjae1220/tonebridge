-- V14 가 계정 삭제 연쇄를 전부 맞춰뒀지만, 뒤에 추가된 V20(correction_likes,
-- correction_requests.accepted_correction_id)이 ON DELETE 없이 참조를 다시 만들었다.
-- 그래서 아래 두 경우에 계정 삭제가 FK 위반으로 통째로 롤백된다(500).
--   1) 삭제하려는 사용자가 교정에 좋아요를 누른 적이 있다
--   2) 삭제로 그 사용자의 요청 → 교정이 연쇄 삭제되는데 그 교정에 남의 좋아요가 달려 있다
-- 운영 DB 확인(pg_constraint.confdeltype): 세 제약 모두 'a'(NO ACTION).

-- 사용자가 지워지면 그 사용자의 좋아요도 함께 지운다.
ALTER TABLE correction_likes
    DROP CONSTRAINT IF EXISTS correction_likes_user_id_fkey;
ALTER TABLE correction_likes
    ADD CONSTRAINT correction_likes_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 교정이 지워지면 그 교정에 달린 좋아요도 함께 지운다.
ALTER TABLE correction_likes
    DROP CONSTRAINT IF EXISTS correction_likes_correction_id_fkey;
ALTER TABLE correction_likes
    ADD CONSTRAINT correction_likes_correction_id_fkey
        FOREIGN KEY (correction_id) REFERENCES corrections(id) ON DELETE CASCADE;

-- 채택 포인터는 가리키던 교정이 사라지면 NULL 로 풀어준다 — 요청 자체는 남을 수 있으므로
-- CASCADE 가 아니라 SET NULL 이다.
ALTER TABLE correction_requests
    DROP CONSTRAINT IF EXISTS correction_requests_accepted_correction_id_fkey;
ALTER TABLE correction_requests
    ADD CONSTRAINT correction_requests_accepted_correction_id_fkey
        FOREIGN KEY (accepted_correction_id) REFERENCES corrections(id) ON DELETE SET NULL;
