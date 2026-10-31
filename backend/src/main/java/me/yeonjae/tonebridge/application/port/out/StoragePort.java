package me.yeonjae.tonebridge.application.port.out;

import java.time.Duration;

public interface StoragePort {

    record PresignedUpload(String uploadUrl, String audioKey) {}

    PresignedUpload generatePresignedUploadUrl(String fileName, String contentType, Duration expiry);

    // Only server-generated keys may be passed here.
    PresignedUpload presignUploadKey(String audioKey, String contentType, Duration expiry);

    boolean hasValidAudio(String audioKey, String contentType);

    String generatePresignedDownloadUrl(String audioKey, Duration expiry);

    void deleteObject(String audioKey);
}
