-- Allow cascade deletion of all user-owned data when a user account is deleted.
-- Corrections written by a deleted user retain corrector_id = NULL so the
-- correction history is preserved for the requester.

-- correction_requests → corrections (request deleted → corrections deleted)
ALTER TABLE corrections
    DROP CONSTRAINT IF EXISTS corrections_request_id_fkey;
ALTER TABLE corrections
    ADD CONSTRAINT corrections_request_id_fkey
        FOREIGN KEY (request_id) REFERENCES correction_requests(id) ON DELETE CASCADE;

-- corrections → ratings (correction deleted → ratings deleted)
ALTER TABLE ratings
    DROP CONSTRAINT IF EXISTS ratings_correction_id_fkey;
ALTER TABLE ratings
    ADD CONSTRAINT ratings_correction_id_fkey
        FOREIGN KEY (correction_id) REFERENCES corrections(id) ON DELETE CASCADE;

-- users → correction_requests (user deleted → their requests deleted)
ALTER TABLE correction_requests
    DROP CONSTRAINT IF EXISTS correction_requests_requester_id_fkey;
ALTER TABLE correction_requests
    ADD CONSTRAINT correction_requests_requester_id_fkey
        FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE;

-- users → corrections.corrector_id (user deleted → corrector set to NULL)
ALTER TABLE corrections
    DROP CONSTRAINT IF EXISTS corrections_corrector_id_fkey;
ALTER TABLE corrections
    ADD CONSTRAINT corrections_corrector_id_fkey
        FOREIGN KEY (corrector_id) REFERENCES users(id) ON DELETE SET NULL;

-- users → credit_transactions (user deleted → transactions deleted)
ALTER TABLE credit_transactions
    DROP CONSTRAINT IF EXISTS credit_transactions_user_id_fkey;
ALTER TABLE credit_transactions
    ADD CONSTRAINT credit_transactions_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- users → ratings.rater_id (user deleted → their ratings deleted)
ALTER TABLE ratings
    DROP CONSTRAINT IF EXISTS ratings_rater_id_fkey;
ALTER TABLE ratings
    ADD CONSTRAINT ratings_rater_id_fkey
        FOREIGN KEY (rater_id) REFERENCES users(id) ON DELETE CASCADE;

-- users → user_badges (user deleted → badges deleted)
ALTER TABLE user_badges
    DROP CONSTRAINT IF EXISTS user_badges_user_id_fkey;
ALTER TABLE user_badges
    ADD CONSTRAINT user_badges_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- users → friend_requests (user deleted → their friend requests deleted)
ALTER TABLE friend_requests
    DROP CONSTRAINT IF EXISTS friend_requests_sender_id_fkey;
ALTER TABLE friend_requests
    ADD CONSTRAINT friend_requests_sender_id_fkey
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE friend_requests
    DROP CONSTRAINT IF EXISTS friend_requests_receiver_id_fkey;
ALTER TABLE friend_requests
    ADD CONSTRAINT friend_requests_receiver_id_fkey
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE;

-- users → study_sessions.created_by (user deleted → sessions deleted)
ALTER TABLE study_sessions
    DROP CONSTRAINT IF EXISTS study_sessions_created_by_fkey;
ALTER TABLE study_sessions
    ADD CONSTRAINT study_sessions_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;

-- users → session_members (user deleted → membership deleted)
ALTER TABLE session_members
    DROP CONSTRAINT IF EXISTS session_members_user_id_fkey;
ALTER TABLE session_members
    ADD CONSTRAINT session_members_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- users → study_cards.created_by_user_id (user deleted → their cards deleted)
ALTER TABLE study_cards
    DROP CONSTRAINT IF EXISTS study_cards_created_by_user_id_fkey;
ALTER TABLE study_cards
    ADD CONSTRAINT study_cards_created_by_user_id_fkey
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE;

-- users → learner_attempts (user deleted → attempts deleted)
ALTER TABLE learner_attempts
    DROP CONSTRAINT IF EXISTS learner_attempts_learner_id_fkey;
ALTER TABLE learner_attempts
    ADD CONSTRAINT learner_attempts_learner_id_fkey
        FOREIGN KEY (learner_id) REFERENCES users(id) ON DELETE CASCADE;
