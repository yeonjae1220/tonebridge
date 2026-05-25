package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.studycard.CardNativeAudio;

import java.util.UUID;

public interface AddCardNativeAudioUseCase {
    record GetUrlCommand(UUID cardId, UUID uploaderId, String fileName) {}
    record ConfirmCommand(UUID cardId, UUID uploaderId, String audioKey) {}

    UploadNativeAudioUseCase.UploadUrlResult getUploadUrl(GetUrlCommand command);
    CardNativeAudio confirm(ConfirmCommand command);
}
