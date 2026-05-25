package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.studycard.CardNativeAudio;

import java.util.List;
import java.util.UUID;

public interface GetCardNativeAudiosUseCase {
    List<CardNativeAudio> getAudios(UUID cardId, UUID requesterId);
    String getDownloadUrl(UUID audioId, UUID requesterId);
}
