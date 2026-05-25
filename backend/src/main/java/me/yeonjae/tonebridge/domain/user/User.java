package me.yeonjae.tonebridge.domain.user;

import java.time.LocalDate;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record User(
        UUID id,
        String email,
        String username,
        String nativeLanguage,
        List<String> fluentLanguages,
        List<String> learningLanguages,
        String nativeDialect,
        Map<String, String> fluentLanguageVariants,
        Map<String, String> learningLanguageVariants,
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
                learningLanguages, nativeDialect, fluentLanguageVariants, learningLanguageVariants,
                newCredits, reputationScore, correctorLevel,
                correctionStreak, lastCorrectionDate, createdAt, isAdmin);
    }

    public User withStreak(int newStreak, LocalDate newLastCorrectionDate) {
        return new User(id, email, username, nativeLanguage, fluentLanguages,
                learningLanguages, nativeDialect, fluentLanguageVariants, learningLanguageVariants,
                credits, reputationScore, correctorLevel,
                newStreak, newLastCorrectionDate, createdAt, isAdmin);
    }

    public User withReputation(double newReputationScore) {
        return new User(id, email, username, nativeLanguage, fluentLanguages,
                learningLanguages, nativeDialect, fluentLanguageVariants, learningLanguageVariants,
                credits, newReputationScore, correctorLevel,
                correctionStreak, lastCorrectionDate, createdAt, isAdmin);
    }

    public User withLanguages(String nativeLanguage, List<String> fluentLanguages,
            List<String> learningLanguages, String nativeDialect,
            Map<String, String> fluentLanguageVariants, Map<String, String> learningLanguageVariants) {
        return new User(id, email, username, nativeLanguage, fluentLanguages,
                learningLanguages, nativeDialect, fluentLanguageVariants, learningLanguageVariants,
                credits, reputationScore, correctorLevel,
                correctionStreak, lastCorrectionDate, createdAt, isAdmin);
    }

    public User withUsername(String newUsername) {
        return new User(id, email, newUsername, nativeLanguage, fluentLanguages,
                learningLanguages, nativeDialect, fluentLanguageVariants, learningLanguageVariants,
                credits, reputationScore, correctorLevel,
                correctionStreak, lastCorrectionDate, createdAt, isAdmin);
    }

    public boolean hasEnoughCredits(int required) {
        return credits >= required;
    }
}
