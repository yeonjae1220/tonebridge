package me.yeonjae.tonebridge.application.port.out;

import java.time.Duration;

public interface StoragePort {

    record PresignedUpload(String uploadUrl, String audioKey) {}

    PresignedUpload generatePresignedUploadUrl(String fileName, String contentType, Duration expiry);

    String generatePresignedDownloadUrl(String audioKey, Duration expiry);
}
