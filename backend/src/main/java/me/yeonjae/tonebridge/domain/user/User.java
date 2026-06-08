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
        String uiLanguage,
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
        boolean isAdmin,
        OAuthProvider provider,
        String passwordHash
) {
    public User withCredits(int newCredits) {
        return new User(id, email, username, nativeLanguage, uiLanguage, fluentLanguages,
                learningLanguages, nativeDialect, fluentLanguageVariants, learningLanguageVariants,
                newCredits, reputationScore, correctorLevel,
                correctionStreak, lastCorrectionDate, createdAt, isAdmin, provider, passwordHash);
    }

    public User withStreak(int newStreak, LocalDate newLastCorrectionDate) {
        return new User(id, email, username, nativeLanguage, uiLanguage, fluentLanguages,
                learningLanguages, nativeDialect, fluentLanguageVariants, learningLanguageVariants,
                credits, reputationScore, correctorLevel,
                newStreak, newLastCorrectionDate, createdAt, isAdmin, provider, passwordHash);
    }

    public User withReputation(double newReputationScore) {
        return new User(id, email, username, nativeLanguage, uiLanguage, fluentLanguages,
                learningLanguages, nativeDialect, fluentLanguageVariants, learningLanguageVariants,
                credits, newReputationScore, correctorLevel,
                correctionStreak, lastCorrectionDate, createdAt, isAdmin, provider, passwordHash);
    }

    public User withLanguages(String nativeLanguage, String uiLanguage, List<String> fluentLanguages,
            List<String> learningLanguages, String nativeDialect,
            Map<String, String> fluentLanguageVariants, Map<String, String> learningLanguageVariants) {
        return new User(id, email, username, nativeLanguage, uiLanguage, fluentLanguages,
                learningLanguages, nativeDialect, fluentLanguageVariants, learningLanguageVariants,
                credits, reputationScore, correctorLevel,
                correctionStreak, lastCorrectionDate, createdAt, isAdmin, provider, passwordHash);
    }

    public User withUsername(String newUsername) {
        return new User(id, email, newUsername, nativeLanguage, uiLanguage, fluentLanguages,
                learningLanguages, nativeDialect, fluentLanguageVariants, learningLanguageVariants,
                credits, reputationScore, correctorLevel,
                correctionStreak, lastCorrectionDate, createdAt, isAdmin, provider, passwordHash);
    }

    public boolean hasEnoughCredits(int required) {
        return credits >= required;
    }

    /** 이메일/비밀번호로 직접 로그인 가능한 LOCAL 계정인지 여부. */
    public boolean isLocalAccount() {
        return provider == OAuthProvider.LOCAL && passwordHash != null;
    }
}
