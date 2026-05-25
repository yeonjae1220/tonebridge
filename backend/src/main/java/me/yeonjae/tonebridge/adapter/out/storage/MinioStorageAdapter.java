package me.yeonjae.tonebridge.adapter.out.storage;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.StoragePort;
import me.yeonjae.tonebridge.shared.config.ToneBridgeProperties;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.time.Duration;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class MinioStorageAdapter implements StoragePort {

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final ToneBridgeProperties properties;

    @Override
    public PresignedUpload generatePresignedUploadUrl(String fileName, String contentType, Duration expiry) {
        String audioKey = "audio/" + UUID.randomUUID() + "/" + sanitize(fileName);
        String bucket = properties.getStorage().getBucket();

        PutObjectRequest putRequest = PutObjectRequest.builder()
                .bucket(bucket)
                .key(audioKey)
                .contentType(contentType)
                .build();

        String uploadUrl = s3Presigner.presignPutObject(
                PutObjectPresignRequest.builder()
                        .signatureDuration(expiry)
                        .putObjectRequest(putRequest)
                        .build()
        ).url().toString();

        return new PresignedUpload(uploadUrl, audioKey);
    }

    @Override
    public String generatePresignedDownloadUrl(String audioKey, Duration expiry) {
        String bucket = properties.getStorage().getBucket();

        GetObjectRequest getRequest = GetObjectRequest.builder()
                .bucket(bucket)
                .key(audioKey)
                .build();

        return s3Presigner.presignGetObject(
                GetObjectPresignRequest.builder()
                        .signatureDuration(expiry)
                        .getObjectRequest(getRequest)
                        .build()
        ).url().toString();
    }

    @Override
    public void deleteObject(String audioKey) {
        s3Client.deleteObject(DeleteObjectRequest.builder()
                .bucket(properties.getStorage().getBucket())
                .key(audioKey)
                .build());
    }

    private static String sanitize(String fileName) {
        return fileName.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}
