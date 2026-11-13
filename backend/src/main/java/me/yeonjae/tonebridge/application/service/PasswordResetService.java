package me.yeonjae.tonebridge.application.service;
import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.*;
import me.yeonjae.tonebridge.shared.exception.*;
import me.yeonjae.tonebridge.shared.security.TokenDigest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Locale;
import java.util.Optional;
@Service
@RequiredArgsConstructor
public class PasswordResetService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private final UserPort users;
    private final PasswordResetTokenPort tokens;
    private final PasswordHasherPort hasher;
    private final RefreshTokenPort refreshTokens;
    private final org.springframework.context.ApplicationEventPublisher events;
    public record MailTicket(String email, String token) { @Override public String toString() { return "MailTicket[redacted]"; } }

    @Transactional
    public Optional<MailTicket> issue(String email) {
        return users.findByEmailForUpdate(email.trim().toLowerCase(Locale.ROOT)).filter(u -> u.isLocalAccount()).map(user -> {
            byte[] bytes = new byte[32]; RANDOM.nextBytes(bytes);
            String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
            tokens.save(new PasswordResetTokenPort.ResetToken(TokenDigest.sha256(raw), user.id(),
                    users.credentialsVersion(user.id()), Instant.now().plusSeconds(900)));
            return new MailTicket(user.email(),raw);
        });
    }

    @Transactional
    public void confirm(String raw, String password) {
        var token = tokens.find(TokenDigest.sha256(raw)).orElseThrow(PasswordResetService::invalid);
        var user = users.findByIdForUpdate(token.userId()).filter(u -> u.isLocalAccount()).orElseThrow(PasswordResetService::invalid);
        // Recheck AFTER the user lock: concurrent confirmations and logins serialize on the same row.
        if (!token.expiresAt().isAfter(Instant.now()) || token.credentialsVersion() != users.credentialsVersion(user.id())) throw invalid();
        users.resetPassword(user.id(),hasher.encode(password));
        tokens.deleteForUser(user.id());
        refreshTokens.deleteAllByUserId(user.id());
        events.publishEvent(new me.yeonjae.tonebridge.shared.event.CredentialsReset(user.id()));
    }
    private static ToneBridgeException invalid() { return new ToneBridgeException(ErrorCode.PASSWORD_RESET_INVALID); }
}
