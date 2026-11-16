package me.yeonjae.tonebridge.application.port.out;

import me.yeonjae.tonebridge.domain.correction.Rating;

import java.util.UUID;
import java.util.List;
import java.util.Set;

public interface RatingPort {
    Set<UUID> findRatedCorrectionIds(List<UUID> correctionIds, UUID raterId);
    boolean existsByCorrection(UUID correctionId);
    Rating save(Rating rating);
    double findHelpfulRatioByCorrector(UUID correctorId, int limit);
}
