package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.in.ValidateAudioKeyAccessUseCase;
import me.yeonjae.tonebridge.application.port.out.StoragePort;
import me.yeonjae.tonebridge.shared.config.ToneBridgeProperties;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/storage")
@Validated
@RequiredArgsConstructor
public class StorageController {

    private final StoragePort storagePort;
    private final ValidateAudioKeyAccessUseCase validateAccessUseCase;
    private final ToneBridgeProperties properties;

    /** Allowed MIME types for audio uploads. */
    private static final Set<String> ALLOWED_AUDIO_TYPES = Set.of(
            "audio/mpeg",
            "audio/mp4",
            "audio/ogg",
            "audio/wav",
            "audio/webm",
            "audio/aac",
            "audio/x-aac",
            "audio/3gpp"
    );

    record PresignedUploadRequest(
            @NotBlank String fileName,
            @NotBlank String contentType) {}

    record PresignedUploadResponse(String uploadUrl, String audioKey) {}
    record PresignedDownloadResponse(String downloadUrl) {}

    @PostMapping("/presigned-upload")
    public ResponseEntity<PresignedUploadResponse> presignedUpload(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody PresignedUploadRequest req) {

        if (!ALLOWED_AUDIO_TYPES.contains(req.contentType())) {
            return ResponseEntity.badRequest().build();
        }

        Duration ttl = Duration.ofMinutes(properties.getStorage().getUploadTtlMinutes());
        var result = storagePort.generatePresignedUploadUrl(req.fileName(), req.contentType(), ttl);
        return ResponseEntity.ok(new PresignedUploadResponse(result.uploadUrl(), result.audioKey()));
    }

    @GetMapping("/presigned-download")
    public ResponseEntity<PresignedDownloadResponse> presignedDownload(
            @AuthenticationPrincipal UUID userId,
            @RequestParam @NotBlank String key) {
        validateAccessUseCase.validate(userId, key);
        Duration ttl = Duration.ofMinutes(properties.getStorage().getDownloadTtlMinutes());
        String downloadUrl = storagePort.generatePresignedDownloadUrl(key, ttl);
        return ResponseEntity.ok(new PresignedDownloadResponse(downloadUrl));
    }
}
