package me.yeonjae.tonebridge.application.service;
import lombok.extern.slf4j.Slf4j;
import me.yeonjae.tonebridge.application.port.out.*;
import me.yeonjae.tonebridge.shared.security.PasswordResetRateLimiter;
import me.yeonjae.tonebridge.shared.exception.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.time.Instant;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
@Service @Slf4j
public class PasswordResetDelivery {
    private final me.yeonjae.tonebridge.shared.config.PasswordResetProperties properties;
    private final Executor executor;
    private final PasswordResetService reset;
    private final PasswordResetMailPort mail;
    private final PasswordResetTokenPort tokens;
    private final PasswordResetRateLimiter limits;
    public PasswordResetDelivery(@Qualifier("passwordResetExecutor") Executor executor, PasswordResetService reset,
            PasswordResetMailPort mail, PasswordResetTokenPort tokens, PasswordResetRateLimiter limits, me.yeonjae.tonebridge.shared.config.PasswordResetProperties properties) {
        this.properties=properties;
        this.executor=executor;this.reset=reset;this.mail=mail;this.tokens=tokens;this.limits=limits;
    }
    public void enqueue(String email) {
        try { executor.execute(() -> deliver(email)); }
        catch (RejectedExecutionException e) { throw new ToneBridgeException(ErrorCode.PASSWORD_RESET_UNAVAILABLE); }
    }
    void deliver(String email) {
        try {
            // The separate service transaction commits the hashed token before SMTP delivery.
            reset.issue(email).ifPresent(ticket -> {
                if (limits.allowMail()) mail.send(ticket.email(),ticket.token());
            });
        } catch (RuntimeException e) {
            log.warn("Password reset delivery failed; type={}",e.getClass().getSimpleName());
        }
    }
    @Scheduled(initialDelay=3600000,fixedDelay=3600000)
    public void purgeExpired() { if (properties.isEnabled()) tokens.purgeExpired(Instant.now()); }
}
