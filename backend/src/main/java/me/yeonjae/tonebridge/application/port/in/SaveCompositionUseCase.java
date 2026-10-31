package me.yeonjae.tonebridge.application.port.in;

import jakarta.validation.constraints.*;
import java.util.List;
import java.util.UUID;
import me.yeonjae.tonebridge.application.port.out.StoragePort;

public interface SaveCompositionUseCase {
    enum Kind { TEXT, AUDIO }
    enum Destination { PERSONAL, FRIEND, COMMUNITY }
    record Input(@NotNull Kind kind, @NotNull Destination destination, UUID friendId,
                 @Size(max = 100) String title, @Size(max = 10000) String contentText,
                 @Size(max = 10000) String context, @Size(max = 100) String audioTitle,
                 @Size(max = 20) String targetLanguage, @Size(max = 30) String targetVariant,
                 @NotNull @Size(max = 6) List<@NotBlank @Size(max = 50) String> goals) {}
    record Result(String type, UUID sessionId, UUID cardId, UUID requestId) {}
    Result save(UUID owner, UUID operation, Input input);
    Result status(UUID owner, UUID operation);
    Result cancel(UUID owner, UUID operation);
    StoragePort.PresignedUpload upload(UUID owner, UUID operation, String contentType);
}
