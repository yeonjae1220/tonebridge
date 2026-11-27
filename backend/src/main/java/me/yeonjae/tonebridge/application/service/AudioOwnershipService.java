package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.Collection;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AudioOwnershipService {
    private final JdbcTemplate jdbc;
    @Transactional
    public void register(UUID owner,String serverGeneratedKey) {
        jdbc.update("INSERT INTO audio_upload_owners(audio_key,owner_id) VALUES (?,?)", serverGeneratedKey,owner);
    }

    /** Returns the subset of {@code keys} that {@code owner} uploaded. Legacy keys have no owner row. */
    @Transactional(readOnly = true)
    public Set<String> ownedBy(UUID owner, Collection<String> keys) {
        if (keys.isEmpty()) return Set.of();
        return Set.copyOf(jdbc.queryForList(
                "SELECT audio_key FROM audio_upload_owners WHERE owner_id = ? AND audio_key = ANY(?)",
                String.class, owner, keys.toArray(String[]::new)));
    }
}
