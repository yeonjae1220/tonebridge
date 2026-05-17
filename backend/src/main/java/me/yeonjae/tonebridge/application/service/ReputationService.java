package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.RatingPort;
import me.yeonjae.tonebridge.application.port.out.UserPort;
import me.yeonjae.tonebridge.domain.user.User;
import me.yeonjae.tonebridge.shared.config.ToneBridgeProperties;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ReputationService {

    private static final int RECENT_RATING_COUNT = 20;

    private final ToneBridgeProperties properties;
    private final RatingPort ratingPort;
    private final UserPort userPort;

    @Transactional
    public void recalculate(UUID correctorId) {
        if (!properties.getGamification().isReputationEnabled()) return;

        double ratio = ratingPort.findHelpfulRatioByCorrector(correctorId, RECENT_RATING_COUNT);
        double newScore = Math.round(ratio * 10.0 * 10.0) / 10.0;

        User user = userPort.findById(correctorId).orElseThrow();
        userPort.save(user.withReputation(newScore));
    }
}
