package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.in.CompleteOnboardingUseCase;
import me.yeonjae.tonebridge.application.port.in.DeleteCurrentUserUseCase;
import me.yeonjae.tonebridge.application.port.in.GetCurrentUserUseCase;
import me.yeonjae.tonebridge.application.port.in.SearchUsersUseCase;
import me.yeonjae.tonebridge.application.port.in.UpdateLanguagesUseCase;
import me.yeonjae.tonebridge.application.port.in.UpdateNicknameUseCase;
import me.yeonjae.tonebridge.application.port.out.RefreshTokenPort;
import me.yeonjae.tonebridge.application.port.out.UserPort;
import me.yeonjae.tonebridge.domain.user.User;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class UserService implements CompleteOnboardingUseCase, DeleteCurrentUserUseCase,
        GetCurrentUserUseCase, UpdateLanguagesUseCase, UpdateNicknameUseCase, SearchUsersUseCase {

    private final UserPort userPort;
    private final RefreshTokenPort refreshTokenPort;

    private static final int MAX_SEARCH_LIMIT = 20;

    @Override
    public User get(UUID userId) {
        return userPort.findById(userId)
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.USER_NOT_FOUND));
    }

    @Override
    public void complete(CompleteOnboardingUseCase.Command command) {
        User user = get(command.userId());
        if (command.username() != null && !command.username().isBlank()) {
            validateAndSetUsername(user, command.username());
            user = get(command.userId());
        }
        userPort.save(user.withLanguages(
                command.nativeLanguage(), command.fluentLanguages(), command.learningLanguages(),
                command.nativeDialect(), command.fluentLanguageVariants(), command.learningLanguageVariants()));
    }

    @Override
    public void update(UpdateLanguagesUseCase.Command command) {
        User user = get(command.userId());
        userPort.save(user.withLanguages(
                command.nativeLanguage(), command.fluentLanguages(), command.learningLanguages(),
                command.nativeDialect(), command.fluentLanguageVariants(), command.learningLanguageVariants()));
    }

    @Override
    public void update(UpdateNicknameUseCase.Command command) {
        User user = get(command.userId());
        validateAndSetUsername(user, command.username());
    }

    @Override
    @Transactional(readOnly = true)
    public List<User> search(SearchUsersUseCase.Command command) {
        if (command.query() == null || command.query().isBlank()) return List.of();
        int limit = Math.min(command.limit(), MAX_SEARCH_LIMIT);
        return userPort.searchByUsernamePrefix(command.query().strip(), limit)
                .stream()
                .filter(u -> !u.id().equals(command.requesterId()))
                .toList();
    }

    @Override
    public void delete(UUID userId) {
        refreshTokenPort.deleteAllByUserId(userId);
        userPort.deleteById(userId);
    }

    private void validateAndSetUsername(User user, String newUsername) {
        userPort.findByUsername(newUsername).ifPresent(existing -> {
            if (!existing.id().equals(user.id())) {
                throw new ToneBridgeException(ErrorCode.USERNAME_ALREADY_EXISTS);
            }
        });
        userPort.save(user.withUsername(newUsername));
    }
}
