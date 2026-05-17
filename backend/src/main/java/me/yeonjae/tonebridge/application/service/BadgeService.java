package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.BadgePort;
import me.yeonjae.tonebridge.application.port.out.CorrectionPort;
import me.yeonjae.tonebridge.domain.user.BadgeType;
import me.yeonjae.tonebridge.domain.user.UserBadge;
import me.yeonjae.tonebridge.shared.config.ToneBridgeProperties;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BadgeService {

    private final ToneBridgeProperties properties;
    private final BadgePort badgePort;
    private final CorrectionPort correctionPort;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void evaluateAfterCorrection(UUID correctorId, int currentStreak) {
        if (!properties.getGamification().isBadgesEnabled()) return;

        if (currentStreak >= 7) {
            awardIfAbsent(correctorId, BadgeType.STREAK_7DAY);
        }

        long audioCount = correctionPort.countApprovedAudioByCorrector(correctorId);
        if (audioCount >= properties.getGamification().getBadgeAudioExpertCount()) {
            awardIfAbsent(correctorId, BadgeType.AUDIO_EXPERT);
        }

        int fastCount = countFastCorrections(correctorId);
        if (fastCount >= properties.getGamification().getBadgeFastResponderCount()) {
            awardIfAbsent(correctorId, BadgeType.FAST_RESPONDER);
        }
    }

    private int countFastCorrections(UUID correctorId) {
        List<Object[]> timings = correctionPort.findCorrectionTimingsByCorrector(correctorId);
        int maxMinutes = properties.getGamification().getFastResponderMaxMinutes();
        int count = 0;
        for (Object[] row : timings) {
            Instant correctionCreatedAt = toInstant(row[0]);
            Instant requestCreatedAt = toInstant(row[1]);
            if (correctionCreatedAt == null || requestCreatedAt == null) continue;
            long diffMinutes = (correctionCreatedAt.toEpochMilli() - requestCreatedAt.toEpochMilli()) / 60_000;
            if (diffMinutes >= 0 && diffMinutes <= maxMinutes) count++;
        }
        return count;
    }

    private Instant toInstant(Object value) {
        if (value instanceof Instant i) return i;
        if (value instanceof java.sql.Timestamp ts) return ts.toInstant();
        return null;
    }

    private void awardIfAbsent(UUID userId, BadgeType type) {
        if (!badgePort.exists(userId, type)) {
            badgePort.save(new UserBadge(null, userId, type, Instant.now()));
        }
    }
}
