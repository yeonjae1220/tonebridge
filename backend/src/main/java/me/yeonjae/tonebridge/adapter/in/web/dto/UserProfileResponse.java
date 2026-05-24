package me.yeonjae.tonebridge.adapter.in.web.dto;

import me.yeonjae.tonebridge.application.port.in.GetUserProfileUseCase;
import me.yeonjae.tonebridge.domain.user.BadgeType;
import me.yeonjae.tonebridge.domain.user.CorrectorLevel;
import me.yeonjae.tonebridge.domain.user.UserBadge;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record UserProfileResponse(
        UUID id,
        String username,
        String nativeLanguage,
        String nativeDialect,
        List<String> fluentLanguages,
        List<String> learningLanguages,
        Map<String, String> fluentLanguageVariants,
        Map<String, String> learningLanguageVariants,
        int correctionStreak,
        double reputationScore,
        CorrectorLevel correctorLevel,
        List<BadgeDto> badges
) {
    public record BadgeDto(BadgeType badgeType, Instant awardedAt) {
        static BadgeDto from(UserBadge badge) {
            return new BadgeDto(badge.badgeType(), badge.awardedAt());
        }
    }

    public static UserProfileResponse from(GetUserProfileUseCase.Result result) {
        return new UserProfileResponse(
                result.id(),
                result.username(),
                result.nativeLanguage(),
                result.nativeDialect(),
                result.fluentLanguages(),
                result.learningLanguages(),
                Map.copyOf(result.fluentLanguageVariants()),
                Map.copyOf(result.learningLanguageVariants()),
                result.correctionStreak(),
                result.reputationScore(),
                result.correctorLevel(),
                result.badges().stream().map(BadgeDto::from).toList()
        );
    }
}
