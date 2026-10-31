package me.yeonjae.tonebridge.adapter.out.persistence;

import me.yeonjae.tonebridge.shared.event.LearningActivity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** Eligibility is always server-side; membership and consent are never taken from request bodies. */
@Component
@Transactional(propagation = Propagation.MANDATORY)
public class ValidationCollectionPolicy {
    private final JdbcTemplate jdbc;
    private final boolean enabled;
    private final boolean durableStorageSupported;

    public ValidationCollectionPolicy(JdbcTemplate jdbc,
            @Value("${tonebridge.validation.enabled:false}") boolean enabled) {
        this.jdbc = jdbc;
        this.enabled = enabled;
        this.durableStorageSupported = Boolean.TRUE.equals(jdbc.execute((ConnectionCallback<Boolean>) connection ->
                "PostgreSQL".equals(connection.getMetaData().getDatabaseProductName())));
        if (enabled && !durableStorageSupported) {
            throw new IllegalStateException("Pilot collection requires PostgreSQL with Flyway migrations");
        }
    }

    public boolean supportsDurableStorage() { return durableStorageSupported; }

    public boolean allowsUser(UUID userId) {
        return enabled && userId != null && lockEligible(Set.of(userId));
    }

    public boolean allowsActivity(LearningActivity event) {
        if (!enabled || event.actorId() == null) return false;
        Set<UUID> subjects = new HashSet<>();
        subjects.add(event.actorId());
        if (event.peerId() != null) subjects.add(event.peerId());
        if (event.sessionId() != null) {
            var members = jdbc.queryForList("SELECT user_id FROM session_members WHERE session_id = ?",
                    UUID.class, event.sessionId());
            if (!members.contains(event.actorId())) return false;
            subjects.addAll(members);
        }
        return lockEligible(subjects);
    }

    private boolean lockEligible(Set<UUID> subjects) {
        String placeholders = subjects.stream().map(id -> "?").collect(Collectors.joining(","));
        // Shared row locks live until the enclosing write commits. Revocation UPDATE waits for them;
        // subsequent cleanup therefore cannot be followed by a late pre-revocation event commit.
        // Consistent ordering also avoids opposite-direction friend activity taking locks out of order.
        var locked = jdbc.queryForList("""
                SELECT user_id FROM validation_participants
                WHERE user_id IN (%s) ORDER BY user_id FOR SHARE
                """.formatted(placeholders), UUID.class, subjects.toArray());
        if (locked.size() != subjects.size()) return false;
        // A SELECT's statement_timestamp is fixed before any row-lock wait. Evaluate the window
        // in a new statement AFTER every lock is acquired, otherwise a queued write can collect
        // after consent expires. Shared locks still prevent revocation until this transaction ends.
        Integer eligible = jdbc.queryForObject("""
                SELECT count(*) FROM validation_participants
                WHERE user_id IN (%s) AND revoked_at IS NULL
                  AND starts_at <= statement_timestamp() AND ends_at > statement_timestamp()
                """.formatted(placeholders), Integer.class, subjects.toArray());
        return eligible != null && eligible == subjects.size();
    }
}
