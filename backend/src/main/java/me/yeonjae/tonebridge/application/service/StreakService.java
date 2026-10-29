package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.UserPort;
import me.yeonjae.tonebridge.domain.user.User;
import me.yeonjae.tonebridge.shared.config.ToneBridgeProperties;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StreakService {

    private final ToneBridgeProperties properties;
    private final UserPort userPort;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int recordCorrection(UUID correctorId) {
        if (!properties.getGamification().isStreakEnabled()) return 0;

        User user = userPort.findById(correctorId).orElseThrow();
        LocalDate today = LocalDate.now(ZoneId.of("UTC"));

        if (today.equals(user.lastCorrectionDate())) return user.correctionStreak();

        boolean isConsecutive = user.lastCorrectionDate() != null
                && today.minusDays(1).equals(user.lastCorrectionDate());
        int newStreak = isConsecutive ? user.correctionStreak() + 1 : 1;

        userPort.save(user.withStreak(newStreak, today));

        return newStreak;
    }
}
