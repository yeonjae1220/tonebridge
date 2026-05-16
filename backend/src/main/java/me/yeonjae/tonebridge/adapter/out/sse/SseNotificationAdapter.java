package me.yeonjae.tonebridge.adapter.out.sse;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.NotificationPort;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class SseNotificationAdapter implements NotificationPort {

    private final SseEmitterRegistry registry;

    @Override
    public void sendCorrectionReady(UUID userId, UUID correctionId) {
        registry.send(userId, "correction-ready", Map.of("correctionId", correctionId.toString()));
    }
}
