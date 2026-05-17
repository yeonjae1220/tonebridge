package me.yeonjae.tonebridge.application.port.out;

import me.yeonjae.tonebridge.domain.correction.Rating;

import java.util.UUID;

public interface RatingPort {
    boolean existsByCorrection(UUID correctionId);
    Rating save(Rating rating);
    double findHelpfulRatioByCorrector(UUID correctorId, int limit);
}
