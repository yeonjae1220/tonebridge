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

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserProfileService implements GetUserProfileUseCase {

    private final UserPort userPort;
    private final BadgePort badgePort;

    @Override
    public Result getProfile(UUID userId) {
        User user = userPort.findById(userId)
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.USER_NOT_FOUND));

        return new Result(
                user.id(),
                user.username(),
                user.nativeLanguage(),
                user.nativeDialect(),
                user.fluentLanguages(),
                user.correctionStreak(),
                user.reputationScore(),
                user.correctorLevel(),
                badgePort.findByUserId(userId)
        );
    }
}
