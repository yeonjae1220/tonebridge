package me.yeonjae.tonebridge.application.port.out;

import java.util.Optional;
import java.util.UUID;
import me.yeonjae.tonebridge.application.port.in.SaveCompositionUseCase.Result;

public interface CompositionPort {
    record Receipt(String fingerprint, String audioKey, String contentType, Result result, boolean cancelled) {}
    // Serialize all composition writes for this owner, including different
    // operations which might otherwise both create the first notebook.
    void lockOwner(UUID owner);
    Optional<Receipt> find(UUID owner, UUID operation);
    void reserveUpload(UUID owner, UUID operation, String audioKey, String contentType);
    void complete(UUID owner, UUID operation, String fingerprint, Result result);
    void cancel(UUID owner, UUID operation);
}
