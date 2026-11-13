package me.yeonjae.tonebridge.adapter.out.persistence;
import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.PasswordResetTokenPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
@Component
@RequiredArgsConstructor
public class PasswordResetTokenJdbcAdapter implements PasswordResetTokenPort {
    private final JdbcTemplate jdbc;
    public void save(ResetToken t) {
        jdbc.update("INSERT INTO password_reset_tokens (token_hash,user_id,credentials_version,expires_at) VALUES (?,?,?,?)",
                t.hash(),t.userId(),t.credentialsVersion(),Timestamp.from(t.expiresAt()));
    }
    public Optional<ResetToken> find(String hash) {
        return jdbc.query("SELECT * FROM password_reset_tokens WHERE token_hash=?", (rs,n) -> new ResetToken(
                rs.getString("token_hash"),rs.getObject("user_id",UUID.class),rs.getLong("credentials_version"),rs.getTimestamp("expires_at").toInstant()),hash).stream().findFirst();
    }
    public void deleteForUser(UUID userId) { jdbc.update("DELETE FROM password_reset_tokens WHERE user_id=?",userId); }
    public void purgeExpired(Instant now) { jdbc.update("DELETE FROM password_reset_tokens WHERE expires_at<=?",Timestamp.from(now)); }
}
