package me.yeonjae.tonebridge.application.port.out;

import me.yeonjae.tonebridge.domain.correction.Rating;

import java.util.UUID;
import java.util.List;
import java.util.Set;

public interface RatingPort {
    Set<UUID> findRatedCorrectionIds(List<UUID> correctionIds, UUID raterId);
    boolean existsByCorrection(UUID correctionId);
    Rating save(Rating rating);
    RecentRatings findRecentRatings(UUID correctorId, int limit);

    record RecentRatings(int count, long helpfulCount) {
        public double score() {
            return count == 0 ? 5.0 : Math.round(100.0 * helpfulCount / count) / 10.0;
        }
    }
}
