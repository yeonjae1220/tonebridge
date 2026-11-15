package me.yeonjae.tonebridge.application.port.out;

import java.util.Optional;
import java.util.UUID;

public interface SubmissionPort {
    record Receipt(String kind, String fingerprint, UUID resourceId, boolean cancelled) {}
    void lockOwner(UUID owner);
    Optional<Receipt> find(UUID owner, UUID operation);
    void complete(UUID owner, UUID operation, String kind, String fingerprint, UUID resourceId);
    void cancel(UUID owner, UUID operation);
}
