package me.yeonjae.tonebridge.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.CompositionPort;
import me.yeonjae.tonebridge.application.port.in.SaveCompositionUseCase.Result;
import me.yeonjae.tonebridge.shared.exception.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class CompositionJdbcAdapter implements CompositionPort {
    private final JdbcTemplate jdbc;
    public void lockOwner(UUID owner) {
        if (jdbc.queryForList("SELECT id FROM users WHERE id = ? FOR UPDATE", UUID.class, owner).isEmpty())
            throw new ToneBridgeException(ErrorCode.USER_NOT_FOUND);
    }
    public Optional<Receipt> find(UUID owner, UUID operation) {
        return jdbc.query("SELECT * FROM composition_receipts WHERE owner_id = ? AND operation_id = ?",
                (rs, row) -> new Receipt(rs.getString("fingerprint"), rs.getString("audio_key"), rs.getString("content_type"),
                        rs.getString("fingerprint") == null ? null : new Result(
                                rs.getObject("request_id") == null ? "study" : "community",
                                rs.getObject("session_id", UUID.class), rs.getObject("card_id", UUID.class),
                                rs.getObject("request_id", UUID.class)), rs.getBoolean("cancelled")), owner, operation).stream().findFirst();
    }
    public void reserveUpload(UUID owner, UUID operation, String key, String type) {
        jdbc.update("INSERT INTO composition_receipts(owner_id, operation_id, audio_key, content_type) VALUES (?, ?, ?, ?)",
                owner, operation, key, type);
    }
    public void complete(UUID owner, UUID operation, String fingerprint, Result result) {
        jdbc.update("""
                INSERT INTO composition_receipts(owner_id, operation_id, fingerprint, session_id, card_id, request_id)
                VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(owner_id, operation_id) DO UPDATE SET
                fingerprint = EXCLUDED.fingerprint, session_id = EXCLUDED.session_id,
                card_id = EXCLUDED.card_id, request_id = EXCLUDED.request_id
                """, owner, operation, fingerprint, result.sessionId(), result.cardId(), result.requestId());
    }
    public void cancel(UUID owner, UUID operation) {
        jdbc.update("INSERT INTO composition_receipts(owner_id, operation_id, cancelled) VALUES (?, ?, TRUE) "
                + "ON CONFLICT(owner_id, operation_id) DO UPDATE SET cancelled = TRUE", owner, operation);
    }
}
