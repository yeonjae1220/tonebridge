package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.studycard.CardNativeAudio;

import java.util.List;
import java.util.Set;
import java.util.UUID;

public interface GetCardNativeAudiosUseCase {
    List<CardNativeAudio> getAudios(UUID cardId, UUID requesterId);
    /** Ids of the given audios that {@code userId} recorded, so clients only offer to report others' audio. */
    Set<UUID> recordedBy(UUID userId, List<CardNativeAudio> audios);
    String getDownloadUrl(UUID audioId, UUID requesterId);
}
