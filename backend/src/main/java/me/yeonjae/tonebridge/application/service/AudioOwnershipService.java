package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AudioOwnershipService {
    private final JdbcTemplate jdbc;
    @Transactional
    public void register(UUID owner,String serverGeneratedKey) {
        jdbc.update("INSERT INTO audio_upload_owners(audio_key,owner_id) VALUES (?,?)", serverGeneratedKey,owner);
    }
}
