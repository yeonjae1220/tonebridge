package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.user.CorrectorLevel;
import me.yeonjae.tonebridge.domain.user.UserBadge;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface GetUserProfileUseCase {

    Result getProfile(UUID userId);

    record Result(
            UUID id,
            String username,
            String nativeLanguage,
            String uiLanguage,
            String nativeDialect,
            List<String> fluentLanguages,
            List<String> learningLanguages,
            Map<String, String> fluentLanguageVariants,
            Map<String, String> learningLanguageVariants,
            int correctionStreak,
            double reputationScore,
            CorrectorLevel correctorLevel,
            List<UserBadge> badges
    ) {}
}
