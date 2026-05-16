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

    @Bean
    public S3Client s3Client() {
        ToneBridgeProperties.Storage s = properties.getStorage();
        return S3Client.builder()
                .endpointOverride(URI.create(s.getEndpoint()))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(s.getAccessKey(), s.getSecretKey())))
                .region(Region.of(s.getRegion()))
                .forcePathStyle(true)
                .build();
    }

    @Bean
    public S3Presigner s3Presigner() {
        ToneBridgeProperties.Storage s = properties.getStorage();
        return S3Presigner.builder()
                .endpointOverride(URI.create(s.getEndpoint()))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(s.getAccessKey(), s.getSecretKey())))
                .region(Region.of(s.getRegion()))
                .build();
    }
}
