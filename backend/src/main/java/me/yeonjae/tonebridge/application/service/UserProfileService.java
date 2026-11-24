package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.in.GetUserProfileUseCase;
import me.yeonjae.tonebridge.application.port.out.BadgePort;
import me.yeonjae.tonebridge.application.port.out.UserPort;
import me.yeonjae.tonebridge.domain.user.User;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserProfileService implements GetUserProfileUseCase {

    private final UserPort userPort;
    private final BadgePort badgePort;
    private final ReputationService reputationService;

    @Override
    public Result getProfile(UUID userId) {
        User user = userPort.findById(userId)
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.USER_NOT_FOUND));

        var ratings = reputationService.recentRatings(userId);
        return new Result(
                user.id(),
                user.username(),
                user.nativeLanguage(),
                user.uiLanguage(),
                user.nativeDialect(),
                user.fluentLanguages(),
                user.learningLanguages(),
                user.fluentLanguageVariants() != null ? Map.copyOf(user.fluentLanguageVariants()) : Map.of(),
                user.learningLanguageVariants() != null ? Map.copyOf(user.learningLanguageVariants()) : Map.of(),
                user.correctionStreak(),
                ratings.count() > 0 ? ratings.score() : user.reputationScore(),
                ratings.count(),
                user.correctorLevel(),
                badgePort.findByUserId(userId)
        );
    }
}
