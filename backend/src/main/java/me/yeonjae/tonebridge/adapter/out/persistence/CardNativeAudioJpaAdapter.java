package me.yeonjae.tonebridge.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.CardNativeAudioPort;
import me.yeonjae.tonebridge.domain.studycard.CardNativeAudio;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class CardNativeAudioJpaAdapter implements CardNativeAudioPort {

    private final CardNativeAudioJpaRepository repository;

    @Override
    public CardNativeAudio save(CardNativeAudio audio) {
        return repository.save(CardNativeAudioEntity.fromDomain(audio)).toDomain();
    }

    @Override
    public List<CardNativeAudio> findAllByCardId(UUID cardId) {
        return repository.findAllByCardIdOrderByCreatedAtAsc(cardId)
                .stream()
                .map(CardNativeAudioEntity::toDomain)
                .toList();
    }

    @Override
    public Optional<CardNativeAudio> findById(UUID id) {
        return repository.findById(id).map(CardNativeAudioEntity::toDomain);
    }

    @Override
    public void deleteByIdAndCardId(UUID id, UUID cardId) {
        repository.deleteByIdAndCardId(id, cardId);
    }
}
