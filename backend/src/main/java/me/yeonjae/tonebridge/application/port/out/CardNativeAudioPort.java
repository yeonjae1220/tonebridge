package me.yeonjae.tonebridge.application.port.out;

import me.yeonjae.tonebridge.domain.studycard.CardNativeAudio;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CardNativeAudioPort {
    CardNativeAudio save(CardNativeAudio audio);
    List<CardNativeAudio> findAllByCardId(UUID cardId);
    Optional<CardNativeAudio> findById(UUID id);
    void deleteByIdAndCardId(UUID id, UUID cardId);
}
