package me.yeonjae.tonebridge.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.RatingPort;
import me.yeonjae.tonebridge.domain.correction.Rating;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Component
@RequiredArgsConstructor
@Transactional
public class RatingJpaAdapter implements RatingPort {

    private final RatingJpaRepository repository;

    @Override
    @Transactional(readOnly = true)
    public boolean existsByCorrection(UUID correctionId) {
        return repository.existsByCorrectionId(correctionId);
    }

    @Override
    public Rating save(Rating rating) {
        return repository.save(RatingEntity.fromDomain(rating)).toDomain();
    }
}
