package me.yeonjae.tonebridge.adapter.in.web.dto;

import me.yeonjae.tonebridge.domain.user.User;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record UserResponse(
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
        String correctorLevel,
        int correctionStreak,
        boolean onboardingCompleted
) {
    public static UserResponse from(User user) {
        return new UserResponse(
                user.id(),
                user.email(),
                user.username(),
                user.nativeLanguage(),
                user.fluentLanguages(),
                user.learningLanguages(),
                user.nativeDialect(),
                user.fluentLanguageVariants() != null ? Map.copyOf(user.fluentLanguageVariants()) : Map.of(),
                user.learningLanguageVariants() != null ? Map.copyOf(user.learningLanguageVariants()) : Map.of(),
                user.credits(),
                user.reputationScore(),
                user.correctorLevel().name(),
                user.correctionStreak(),
                !user.nativeLanguage().isBlank()
        );
    }
}
