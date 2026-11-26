package me.yeonjae.tonebridge.application.service;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.yeonjae.tonebridge.application.port.out.StoragePort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Removes a deleted account's recordings from object storage.
 *
 * <p>Account deletion cascades the database rows, but the audio files they pointed to stay in storage.
 * {@link #detach} runs before the user row is deleted, {@link #queueUnreferenced} after it in the same
 * transaction, and {@link #deleteQueued} later from a worker, so a storage outage never blocks or
 * undoes the deletion itself.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AccountAudioPurge {

    private static final int BATCH = 100;
    // Same shape the storage adapter accepts; anything else could never be deleted and would retry forever.
    private static final String KEY_PATTERN = "^audio/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-zA-Z0-9._-]+$";

    private static final String CANDIDATES = """
            WITH own_sessions AS (SELECT id FROM study_sessions WHERE created_by = :user),
                 gone_cards AS (SELECT id FROM study_cards
                                WHERE created_by_user_id = :user OR session_id IN (SELECT id FROM own_sessions)),
                 own_requests AS (SELECT id FROM correction_requests WHERE requester_id = :user)
            SELECT audio_key FROM audio_upload_owners WHERE owner_id = :user
            UNION SELECT audio_url FROM correction_requests WHERE id IN (SELECT id FROM own_requests)
            UNION SELECT reference_audio_url FROM corrections
                  WHERE corrector_id = :user OR request_id IN (SELECT id FROM own_requests)
            UNION SELECT native_audio_url FROM study_cards WHERE id IN (SELECT id FROM gone_cards)
            UNION SELECT audio_key FROM card_native_audio WHERE card_id IN (SELECT id FROM gone_cards)
            UNION SELECT audio_url FROM learner_attempts
                  WHERE learner_id = :user OR card_id IN (SELECT id FROM gone_cards)
            UNION SELECT audio_key FROM composition_receipts WHERE owner_id = :user
            """;

    // Upload ownership alone is not a use: every candidate was attached to a row this deletion removes,
    // so it is not an upload still waiting to be attached. Its stale ownership row is dropped with it.
    private static final String STILL_REFERENCED = """
            EXISTS (SELECT 1 FROM correction_requests WHERE audio_url = :key)
            OR EXISTS (SELECT 1 FROM corrections WHERE reference_audio_url = :key)
            OR EXISTS (SELECT 1 FROM study_cards WHERE native_audio_url = :key)
            OR EXISTS (SELECT 1 FROM card_native_audio WHERE audio_key = :key)
            OR EXISTS (SELECT 1 FROM learner_attempts WHERE audio_url = :key)
            OR EXISTS (SELECT 1 FROM composition_receipts WHERE audio_key = :key)
            """;

    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate named;
    private final EntityManager entityManager;
    private final StoragePort storage;

    /**
     * Collects every audio key the account's deletion will orphan, and removes the user's own voice
     * from records that outlive them: example voices on friends' cards and reference audio on
     * corrections, which stay as text only. Call inside the deleting transaction, before the user row goes.
     */
    public Set<String> detach(UUID userId) {
        List<String> keys = named.queryForList(CANDIDATES, Map.of("user", userId), String.class);
        String owned = "(SELECT audio_key FROM audio_upload_owners WHERE owner_id = ?)";
        jdbc.update("DELETE FROM card_native_audio WHERE audio_key IN " + owned, userId);
        jdbc.update("UPDATE study_cards SET native_audio_url = NULL WHERE native_audio_url IN " + owned, userId);
        jdbc.update("UPDATE corrections SET reference_audio_url = NULL WHERE corrector_id = ?", userId);
        Set<String> candidates = new LinkedHashSet<>();
        for (String key : keys) {
            if (key != null && key.matches(KEY_PATTERN)) candidates.add(key);
        }
        return Set.copyOf(candidates);
    }

    /** Queues the candidates nothing points to any more. Call after the user row is deleted, same transaction. */
    public void queueUnreferenced(Set<String> candidates) {
        // The user row is removed through JPA; push that delete (and its cascades) to the database first.
        entityManager.flush();
        for (String key : candidates) {
            Map<String, String> params = Map.of("key", key);
            int queued = named.update("INSERT INTO account_audio_deletions(audio_key) SELECT CAST(:key AS VARCHAR) WHERE NOT ("
                    + STILL_REFERENCED + ") ON CONFLICT (audio_key) DO NOTHING", params);
            if (queued > 0) named.update("DELETE FROM audio_upload_owners WHERE audio_key = :key", params);
        }
    }

    /**
     * Deletes due objects one by one, outside any transaction, so one failure only delays that key.
     * Storage deletes are idempotent, so a lost response is retried safely.
     */
    public void deleteQueued() {
        List<String> due = jdbc.queryForList(
                "SELECT audio_key FROM account_audio_deletions WHERE next_attempt_at <= now() ORDER BY next_attempt_at LIMIT ?",
                String.class, BATCH);
        for (String key : due) {
            try {
                storage.deleteObject(key);
                jdbc.update("DELETE FROM account_audio_deletions WHERE audio_key = ?", key);
            } catch (RuntimeException e) {
                // Back off 2^attempts minutes, capped at a day; the key stays queued until storage confirms.
                jdbc.update("""
                        UPDATE account_audio_deletions
                        SET attempts = attempts + 1,
                            next_attempt_at = now() + least(power(2, attempts) * interval '1 minute', interval '1 day')
                        WHERE audio_key = ?""", key);
                log.warn("Deleting audio of a deleted account failed; will retry. key={} error={}",
                        key, e.getClass().getSimpleName());
            }
        }
    }
}
