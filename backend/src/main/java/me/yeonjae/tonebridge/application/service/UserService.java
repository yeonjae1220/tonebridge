package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.in.CompleteOnboardingUseCase;
import me.yeonjae.tonebridge.application.port.in.GetCurrentUserUseCase;
import me.yeonjae.tonebridge.application.port.out.UserPort;
import me.yeonjae.tonebridge.domain.user.User;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class UserService implements CompleteOnboardingUseCase, GetCurrentUserUseCase {

    private final UserPort userPort;

    @Override
    public User get(UUID userId) {
        return userPort.findById(userId)
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.USER_NOT_FOUND));
    }

    @Override
    public void complete(Command command) {
        User user = get(command.userId());
        User updated = new User(
                user.id(), user.email(), user.username(),
                command.nativeLanguage(),
                command.fluentLanguages(),
                command.learningLanguages(),
                user.credits(), user.reputationScore(), user.correctorLevel(),
                user.correctionStreak(), user.lastCorrectionDate(), user.createdAt(),
                user.isAdmin()
        );
        userPort.save(updated);
    }
}
