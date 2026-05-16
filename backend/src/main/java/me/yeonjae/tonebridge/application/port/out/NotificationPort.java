package me.yeonjae.tonebridge.application.port.out;

import java.util.UUID;

public interface NotificationPort {
    void sendCorrectionReady(UUID userId, UUID correctionId);
}
