package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.studycard.StudyCard;

import java.util.UUID;

public interface UploadNativeAudioUseCase {
    record Command(UUID cardId, UUID uploaderId, String audioKey) {}
    record GetUrlCommand(UUID cardId, UUID uploaderId, String fileName) {}
    record UploadUrlResult(String uploadUrl, String audioKey) {}

    UploadUrlResult getUploadUrl(GetUrlCommand command);
    StudyCard upload(Command command);
}
