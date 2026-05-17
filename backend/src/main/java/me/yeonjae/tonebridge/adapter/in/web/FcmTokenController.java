package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.adapter.in.web.dto.RegisterFcmTokenRequest;
import me.yeonjae.tonebridge.application.port.in.RegisterFcmTokenUseCase;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/users/me")
@RequiredArgsConstructor
public class FcmTokenController {

    private final RegisterFcmTokenUseCase registerFcmTokenUseCase;

    @PostMapping("/fcm-token")
    public ResponseEntity<Void> registerFcmToken(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody RegisterFcmTokenRequest request) {
        registerFcmTokenUseCase.register(
                new RegisterFcmTokenUseCase.Command(userId, request.token(), request.platform()));
        return ResponseEntity.noContent().build();
    }
}
