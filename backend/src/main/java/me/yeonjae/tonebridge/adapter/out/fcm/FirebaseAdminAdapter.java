package me.yeonjae.tonebridge.adapter.out.fcm;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.MessagingErrorCode;
import lombok.extern.slf4j.Slf4j;
import me.yeonjae.tonebridge.application.port.out.FcmNotificationPort;
import me.yeonjae.tonebridge.application.port.out.FcmTokenPort;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Slf4j
@Component
public class FirebaseAdminAdapter implements FcmNotificationPort {

    private final FcmTokenPort fcmTokenPort;
    private final FirebaseApp firebaseApp;

    public FirebaseAdminAdapter(FcmTokenPort fcmTokenPort, ObjectProvider<FirebaseApp> firebaseAppProvider) {
        this.fcmTokenPort = fcmTokenPort;
        this.firebaseApp = firebaseAppProvider.getIfAvailable();
        if (this.firebaseApp == null) {
            log.warn("FCM service account not configured — push notifications disabled");
        }
    }

    @Override
    public void sendCorrectionReady(UUID userId, UUID correctionId) {
        if (firebaseApp == null) return;

        fcmTokenPort.findByUserId(userId).ifPresent(fcmToken -> {
            Message message = Message.builder()
                    .setToken(fcmToken.token())
                    .putData("type", "CORRECTION_READY")
                    .putData("correctionId", correctionId.toString())
                    .build();
            try {
                FirebaseMessaging.getInstance(firebaseApp).send(message);
                log.debug("FCM sent to userId={}, correctionId={}", userId, correctionId);
            } catch (FirebaseMessagingException e) {
                log.warn("FCM send failed for userId={}: {} ({})", userId, e.getMessage(), e.getMessagingErrorCode());
                if (isTokenInvalid(e)) {
                    fcmTokenPort.deleteByToken(fcmToken.token());
                    log.info("Removed invalid FCM token for userId={}", userId);
                }
            }
        });
    }

    @Override
    public void sendNewStudyCard(UUID userId, UUID sessionId, String phrase) {
        if (firebaseApp == null) return;
        sendToUser(userId, builder -> builder
                .putData("type", "NEW_STUDY_CARD")
                .putData("sessionId", sessionId.toString())
                .putData("phrase", phrase));
    }

    @Override
    public void sendCorrectionNoteAdded(UUID userId, UUID cardId, String senderUsername) {
        if (firebaseApp == null) return;
        sendToUser(userId, builder -> builder
                .putData("type", "CORRECTION_NOTE_ADDED")
                .putData("cardId", cardId.toString())
                .putData("senderUsername", senderUsername));
    }

    private void sendToUser(UUID userId, java.util.function.Consumer<Message.Builder> configurer) {
        fcmTokenPort.findByUserId(userId).ifPresent(fcmToken -> {
            Message.Builder builder = Message.builder().setToken(fcmToken.token());
            configurer.accept(builder);
            try {
                FirebaseMessaging.getInstance(firebaseApp).send(builder.build());
            } catch (FirebaseMessagingException e) {
                log.warn("FCM send failed for userId={}: {}", userId, e.getMessage());
                if (isTokenInvalid(e)) {
                    fcmTokenPort.deleteByToken(fcmToken.token());
                }
            }
        });
    }

    private boolean isTokenInvalid(FirebaseMessagingException e) {
        MessagingErrorCode code = e.getMessagingErrorCode();
        return code == MessagingErrorCode.UNREGISTERED
                || code == MessagingErrorCode.INVALID_ARGUMENT;
    }
}
