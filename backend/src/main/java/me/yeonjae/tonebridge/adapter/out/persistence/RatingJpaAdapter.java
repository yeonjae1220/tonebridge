package me.yeonjae.tonebridge.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.RatingPort;
import me.yeonjae.tonebridge.domain.correction.Rating;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
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

    @Override
    @Transactional(readOnly = true)
    public double findHelpfulRatioByCorrector(UUID correctorId, int limit) {
        List<RatingEntity> recent = repository.findRecentByCorrectorId(
                correctorId, PageRequest.of(0, limit, Sort.by(Sort.Direction.DESC, "createdAt")));
        if (recent.isEmpty()) return 0.5;
        long helpfulCount = recent.stream().filter(RatingEntity::isHelpful).count();
        return (double) helpfulCount / recent.size();
    }
}
