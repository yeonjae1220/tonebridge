package me.yeonjae.tonebridge.shared.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.net.URI;

@Configuration
@RequiredArgsConstructor
public class StorageConfig {

    private final ToneBridgeProperties properties;

    /**
     * Returns true when STORAGE_ENDPOINT is explicitly set (MinIO / local S3-compatible).
     * When blank, the standard AWS SDK endpoint resolution is used (real AWS S3).
     */
    private boolean hasCustomEndpoint(ToneBridgeProperties.Storage s) {
        return s.getEndpoint() != null && !s.getEndpoint().isBlank();
    }

    @Bean
    public S3Client s3Client() {
        ToneBridgeProperties.Storage s = properties.getStorage();
        var builder = S3Client.builder()
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(s.getAccessKey(), s.getSecretKey())))
                .region(Region.of(s.getRegion()));

        if (hasCustomEndpoint(s)) {
            // MinIO or other S3-compatible storage: needs explicit endpoint + path-style
            builder.endpointOverride(URI.create(s.getEndpoint()))
                   .forcePathStyle(true);
        }
        return builder.build();
    }

    @Bean
    public S3Presigner s3Presigner() {
        ToneBridgeProperties.Storage s = properties.getStorage();
        var builder = S3Presigner.builder()
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(s.getAccessKey(), s.getSecretKey())))
                .region(Region.of(s.getRegion()));

        if (hasCustomEndpoint(s)) {
            // Use publicEndpoint so presigned URLs use the host reachable by mobile/browser.
            // Falls back to endpoint when STORAGE_PUBLIC_ENDPOINT is not set.
            String publicEndpoint = (s.getPublicEndpoint() != null && !s.getPublicEndpoint().isBlank())
                    ? s.getPublicEndpoint()
                    : s.getEndpoint();
            builder.endpointOverride(URI.create(publicEndpoint));
        }
        // AWS S3: no endpointOverride → SDK resolves the correct regional endpoint automatically.
        return builder.build();
    }
}
