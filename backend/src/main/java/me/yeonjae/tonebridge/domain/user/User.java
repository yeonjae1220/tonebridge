package me.yeonjae.tonebridge.domain.user;

import java.time.LocalDate;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record User(
        UUID id,
        String email,
        String username,
        String nativeLanguage,
        List<String> fluentLanguages,
        List<String> learningLanguages,
        int credits,
        double reputationScore,
        CorrectorLevel correctorLevel,
        int correctionStreak,
        LocalDate lastCorrectionDate,
        Instant createdAt,
        boolean isAdmin
) {
    public User withCredits(int newCredits) {
        return new User(id, email, username, nativeLanguage, fluentLanguages,
                learningLanguages, newCredits, reputationScore, correctorLevel,
                correctionStreak, lastCorrectionDate, createdAt, isAdmin);
    }

    public User withStreak(int newStreak, LocalDate newLastCorrectionDate) {
        return new User(id, email, username, nativeLanguage, fluentLanguages,
                learningLanguages, credits, reputationScore, correctorLevel,
                newStreak, newLastCorrectionDate, createdAt, isAdmin);
    }

    public User withReputation(double newReputationScore) {
        return new User(id, email, username, nativeLanguage, fluentLanguages,
                learningLanguages, credits, newReputationScore, correctorLevel,
                correctionStreak, lastCorrectionDate, createdAt, isAdmin);
    }

    public boolean hasEnoughCredits(int required) {
        return credits >= required;
    }
}
