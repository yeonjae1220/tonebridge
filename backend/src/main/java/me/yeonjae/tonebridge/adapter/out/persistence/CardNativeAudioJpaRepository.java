package me.yeonjae.tonebridge.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CardNativeAudioJpaRepository extends JpaRepository<CardNativeAudioEntity, UUID> {
    List<CardNativeAudioEntity> findAllByCardIdOrderByCreatedAtAsc(UUID cardId);
    void deleteByIdAndCardId(UUID id, UUID cardId);
}
