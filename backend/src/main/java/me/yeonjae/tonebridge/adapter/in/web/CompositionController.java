package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.in.SaveCompositionUseCase;
import me.yeonjae.tonebridge.application.port.out.StoragePort;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/compositions")
@RequiredArgsConstructor
public class CompositionController {
    private final SaveCompositionUseCase compositions;
    record UploadInput(@NotBlank String contentType) {}
    @PostMapping("/{operation}")
    public SaveCompositionUseCase.Result save(@AuthenticationPrincipal UUID owner, @PathVariable UUID operation,
                                               @Valid @RequestBody SaveCompositionUseCase.Input input) {
        return compositions.save(owner, operation, input);
    }
    @GetMapping("/{operation}")
    public SaveCompositionUseCase.Result status(@AuthenticationPrincipal UUID owner, @PathVariable UUID operation) {
        return compositions.status(owner, operation);
    }
    @PostMapping("/{operation}/upload-url")
    public StoragePort.PresignedUpload upload(@AuthenticationPrincipal UUID owner, @PathVariable UUID operation,
                                               @Valid @RequestBody UploadInput input) {
        return compositions.upload(owner, operation, input.contentType());
    }
    @PostMapping("/{operation}/cancel")
    public org.springframework.http.ResponseEntity<SaveCompositionUseCase.Result> cancel(
            @AuthenticationPrincipal UUID owner, @PathVariable UUID operation) {
        var result = compositions.cancel(owner, operation);
        return result == null ? org.springframework.http.ResponseEntity.noContent().build()
                : org.springframework.http.ResponseEntity.ok(result);
    }
}
