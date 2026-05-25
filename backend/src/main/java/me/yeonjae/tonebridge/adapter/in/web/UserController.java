package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.adapter.in.web.dto.OnboardingRequest;
import me.yeonjae.tonebridge.adapter.in.web.dto.UpdateLanguagesRequest;
import me.yeonjae.tonebridge.adapter.in.web.dto.UserResponse;
import me.yeonjae.tonebridge.adapter.in.web.dto.UserSearchResponse;
import me.yeonjae.tonebridge.application.port.in.CompleteOnboardingUseCase;
import me.yeonjae.tonebridge.application.port.in.DeleteCurrentUserUseCase;
import me.yeonjae.tonebridge.application.port.in.GetCurrentUserUseCase;
import me.yeonjae.tonebridge.application.port.in.SearchUsersUseCase;
import me.yeonjae.tonebridge.application.port.in.UpdateLanguagesUseCase;
import me.yeonjae.tonebridge.application.port.in.UpdateNicknameUseCase;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@Validated
public class UserController {

    private final GetCurrentUserUseCase getCurrentUserUseCase;
    private final CompleteOnboardingUseCase completeOnboardingUseCase;
    private final DeleteCurrentUserUseCase deleteCurrentUserUseCase;
    private final UpdateLanguagesUseCase updateLanguagesUseCase;
    private final UpdateNicknameUseCase updateNicknameUseCase;
    private final SearchUsersUseCase searchUsersUseCase;

    @GetMapping("/me")
    public ResponseEntity<UserResponse> getMe(@AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(UserResponse.from(getCurrentUserUseCase.get(userId)));
    }

    @DeleteMapping("/me")
    public ResponseEntity<Void> deleteMe(@AuthenticationPrincipal UUID userId) {
        deleteCurrentUserUseCase.delete(userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/search")
    public ResponseEntity<List<UserSearchResponse>> searchUsers(
            @AuthenticationPrincipal UUID userId,
            @RequestParam @NotBlank @Size(min = 1, max = 50) String q,
            @RequestParam(defaultValue = "10") int limit) {
        var results = searchUsersUseCase.search(new SearchUsersUseCase.Command(userId, q, limit));
        return ResponseEntity.ok(results.stream().map(UserSearchResponse::from).toList());
    }

    @PatchMapping("/me/username")
    public ResponseEntity<UserResponse> updateUsername(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody UpdateUsernameRequest request) {
        updateNicknameUseCase.update(new UpdateNicknameUseCase.Command(userId, request.username()));
        return ResponseEntity.ok(UserResponse.from(getCurrentUserUseCase.get(userId)));
    }

    @PatchMapping("/me/onboarding")
    public ResponseEntity<UserResponse> completeOnboarding(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody OnboardingRequest request
    ) {
        var command = new CompleteOnboardingUseCase.Command(
                userId,
                request.username(),
                request.nativeLanguage(),
                request.fluentLanguages(),
                request.learningLanguages(),
                request.nativeDialect(),
                request.fluentLanguageVariants() != null ? request.fluentLanguageVariants() : Map.of(),
                request.learningLanguageVariants() != null ? request.learningLanguageVariants() : Map.of()
        );
        completeOnboardingUseCase.complete(command);
        return ResponseEntity.ok(UserResponse.from(getCurrentUserUseCase.get(userId)));
    }

    @PatchMapping("/me/languages")
    public ResponseEntity<UserResponse> updateLanguages(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody UpdateLanguagesRequest request
    ) {
        updateLanguagesUseCase.update(new UpdateLanguagesUseCase.Command(
                userId,
                request.nativeLanguage(),
                request.fluentLanguages(),
                request.learningLanguages(),
                request.nativeDialect(),
                request.fluentLanguageVariants() != null ? request.fluentLanguageVariants() : Map.of(),
                request.learningLanguageVariants() != null ? request.learningLanguageVariants() : Map.of()
        ));
        return ResponseEntity.ok(UserResponse.from(getCurrentUserUseCase.get(userId)));
    }

    record UpdateUsernameRequest(
            @NotBlank @Size(min = 2, max = 20) @Pattern(regexp = "^[a-zA-Z0-9_]+$") String username
    ) {}
}
