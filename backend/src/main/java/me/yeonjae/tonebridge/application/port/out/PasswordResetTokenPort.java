package me.yeonjae.tonebridge.application.port.out;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
public interface PasswordResetTokenPort {
    record ResetToken(String hash, UUID userId, long credentialsVersion, Instant expiresAt) {}
    void save(ResetToken token);
    Optional<ResetToken> find(String hash);
    void deleteForUser(UUID userId);
    void purgeExpired(Instant now);
}
