package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.in.ValidateAudioKeyAccessUseCase;
import me.yeonjae.tonebridge.application.port.out.StoragePort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.UUID;

@RestController
@RequestMapping("/api/storage")
@RequiredArgsConstructor
public class StorageController {

    private final StoragePort storagePort;
    private final ValidateAudioKeyAccessUseCase validateAccessUseCase;

    record PresignedUploadRequest(
            @NotBlank String fileName,
            @NotBlank String contentType) {}

    record PresignedUploadResponse(String uploadUrl, String audioKey) {}
    record PresignedDownloadResponse(String downloadUrl) {}

    @PostMapping("/presigned-upload")
    public ResponseEntity<PresignedUploadResponse> presignedUpload(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody PresignedUploadRequest req) {
        var result = storagePort.generatePresignedUploadUrl(
                req.fileName(), req.contentType(), Duration.ofMinutes(15));
        return ResponseEntity.ok(new PresignedUploadResponse(result.uploadUrl(), result.audioKey()));
    }

    @GetMapping("/presigned-download")
    public ResponseEntity<PresignedDownloadResponse> presignedDownload(
            @AuthenticationPrincipal UUID userId,
            @RequestParam String key) {
        validateAccessUseCase.validate(userId, key);
        String downloadUrl = storagePort.generatePresignedDownloadUrl(key, Duration.ofMinutes(30));
        return ResponseEntity.ok(new PresignedDownloadResponse(downloadUrl));
    }
}
