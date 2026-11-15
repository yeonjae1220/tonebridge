package me.yeonjae.tonebridge.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.SubmissionPort;
import me.yeonjae.tonebridge.shared.exception.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class SubmissionJdbcAdapter implements SubmissionPort {
    private final JdbcTemplate jdbc;
    public void lockOwner(UUID owner) {
        if (jdbc.queryForList("SELECT id FROM users WHERE id = ? FOR UPDATE", UUID.class, owner).isEmpty())
            throw new ToneBridgeException(ErrorCode.USER_NOT_FOUND);
    }
    public Optional<Receipt> find(UUID owner, UUID operation) {
        return jdbc.query("SELECT kind, fingerprint, resource_id, cancelled FROM submission_receipts WHERE owner_id=? AND operation_id=?",
                (rs, row) -> new Receipt(rs.getString("kind"), rs.getString("fingerprint"), rs.getObject("resource_id", UUID.class), rs.getBoolean("cancelled")),
                owner, operation).stream().findFirst();
    }
    public void complete(UUID owner, UUID operation, String kind, String fingerprint, UUID resourceId) {
        jdbc.update("INSERT INTO submission_receipts(owner_id, operation_id, kind, fingerprint, resource_id) VALUES (?, ?, ?, ?, ?)",
                owner, operation, kind, fingerprint, resourceId);
    }
    public void cancel(UUID owner, UUID operation) {
        jdbc.update("INSERT INTO submission_receipts(owner_id, operation_id, cancelled) VALUES (?, ?, TRUE) ON CONFLICT DO NOTHING", owner, operation);
    }
}
