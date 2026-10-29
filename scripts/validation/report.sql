-- psql: -v cohort='[{"a":"UUID","b":"UUID"}]' -v started_at='2026-...Z'
-- Run with a read-only DB session. Output contains counts only, never identifiers/content.
WITH params AS (
  SELECT CAST(:'cohort' AS jsonb) AS cohort, CAST(:'started_at' AS timestamptz) AS started_at
), pairs AS (
  SELECT DISTINCT LEAST(a,b) AS a, GREATEST(a,b) AS b
  FROM params, jsonb_to_recordset(cohort) AS pair(a uuid, b uuid) WHERE a <> b
), connected AS (
  SELECT p.*, COALESCE(
    (SELECT MIN(e.occurred_at) FROM learning_activity e, params v
     WHERE e.kind = 'FRIEND_ACCEPTED' AND LEAST(e.actor_id,e.peer_id)=p.a AND GREATEST(e.actor_id,e.peer_id)=p.b
       AND e.occurred_at < LEAST(v.started_at + interval '7 days', now())),
    (SELECT MIN(f.updated_at) FROM friend_requests f, params v
     WHERE f.status = 'ACCEPTED' AND LEAST(f.sender_id,f.receiver_id)=p.a AND GREATEST(f.sender_id,f.receiver_id)=p.b
       AND f.updated_at < LEAST(v.started_at + interval '7 days', now()))
  ) AS connected_at FROM pairs p
), activity AS (
  SELECT e.* FROM learning_activity e, params v
  WHERE e.occurred_at >= v.started_at AND e.occurred_at < LEAST(v.started_at + interval '14 days', now())
), loops AS (
  SELECT c.a, c.b, f.peer_id AS learner_id, f.card_id, MIN(f.occurred_at) AS feedback_at
  FROM connected c
  JOIN activity f ON f.kind='FEEDBACK_SAVED' AND f.actor_id <> f.peer_id
    AND LEAST(f.actor_id,f.peer_id)=c.a AND GREATEST(f.actor_id,f.peer_id)=c.b
  JOIN activity p ON p.kind='PRACTICE_SAVED' AND p.attempt_id=f.attempt_id
    AND p.actor_id=f.peer_id AND p.session_id=f.session_id AND p.card_id=f.card_id AND p.occurred_at <= f.occurred_at
  CROSS JOIN params v
  WHERE c.connected_at IS NOT NULL AND p.occurred_at >= c.connected_at
    AND f.occurred_at < v.started_at + interval '7 days'
    AND EXISTS (SELECT 1 FROM activity x WHERE x.kind='EXAMPLE_SAVED' AND x.card_id=p.card_id
      AND x.session_id=p.session_id AND x.actor_id=f.actor_id AND x.occurred_at <= p.occurred_at)
  GROUP BY c.a,c.b,f.peer_id,f.card_id
), retried AS (
  SELECT DISTINCT l.a,l.b,l.learner_id FROM loops l
  WHERE EXISTS (SELECT 1 FROM activity p WHERE p.kind='PRACTICE_SAVED'
    AND p.actor_id=l.learner_id AND p.card_id=l.card_id AND p.occurred_at > l.feedback_at)
), returned AS (
  SELECT DISTINCT l.a,l.b FROM loops l CROSS JOIN params v
  WHERE EXISTS (SELECT 1 FROM activity e JOIN session_members m ON m.session_id=e.session_id AND m.user_id=l.b
    WHERE e.actor_id=l.a AND e.occurred_at >= v.started_at+interval '7 days' AND e.kind<>'FRIEND_ACCEPTED')
    AND EXISTS (SELECT 1 FROM activity e JOIN session_members m ON m.session_id=e.session_id AND m.user_id=l.a
    WHERE e.actor_id=l.b AND e.occurred_at >= v.started_at+interval '7 days' AND e.kind<>'FRIEND_ACCEPTED')
)
SELECT (SELECT COUNT(*) FROM pairs) AS registered_pairs,
       (SELECT COUNT(*) FROM connected WHERE connected_at IS NOT NULL) AS connected_pairs,
       (SELECT COUNT(*) FROM (SELECT DISTINCT a,b FROM loops) x) AS first_loop_pairs,
       (SELECT COUNT(*) FROM (SELECT DISTINCT a,b,learner_id FROM loops) x) AS feedback_learners,
       (SELECT COUNT(*) FROM retried) AS retried_learners,
       (SELECT COUNT(*) FROM returned) AS week_two_pairs,
       now() >= started_at + interval '7 days' AS week_one_complete,
       now() >= started_at + interval '14 days' AS week_two_complete
FROM params;
