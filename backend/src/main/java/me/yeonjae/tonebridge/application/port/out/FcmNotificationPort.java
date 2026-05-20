package me.yeonjae.tonebridge.application.port.out;

import java.util.UUID;

public interface FcmNotificationPort {
    void sendCorrectionReady(UUID userId, UUID correctionId);
    void sendNewStudyCard(UUID userId, UUID sessionId, String phrase);
    void sendCorrectionNoteAdded(UUID userId, UUID sessionId, UUID cardId, String senderUsername);
}
