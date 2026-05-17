package me.yeonjae.tonebridge.shared.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.FileInputStream;
import java.io.IOException;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class FirebaseConfig {

    private final ToneBridgeProperties properties;

    @Bean
    @ConditionalOnProperty(name = "tonebridge.fcm.service-account-path")
    public FirebaseApp firebaseApp() throws IOException {
        if (!FirebaseApp.getApps().isEmpty()) {
            return FirebaseApp.getInstance();
        }

        String serviceAccountPath = properties.getFcm().getServiceAccountPath();

        GoogleCredentials credentials = GoogleCredentials
                .fromStream(new FileInputStream(serviceAccountPath));

        FirebaseOptions options = FirebaseOptions.builder()
                .setCredentials(credentials)
                .build();

        log.info("Firebase initialized with service account: {}", serviceAccountPath);
        return FirebaseApp.initializeApp(options);
    }
}
