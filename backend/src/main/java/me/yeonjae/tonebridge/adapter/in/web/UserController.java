package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.adapter.in.web.dto.OnboardingRequest;
import me.yeonjae.tonebridge.adapter.in.web.dto.UpdateLanguagesRequest;
import me.yeonjae.tonebridge.adapter.in.web.dto.UserResponse;
import me.yeonjae.tonebridge.application.port.in.CompleteOnboardingUseCase;
import me.yeonjae.tonebridge.application.port.in.GetCurrentUserUseCase;
import me.yeonjae.tonebridge.application.port.in.UpdateLanguagesUseCase;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@Validated
public class UserController {

    private final GetCurrentUserUseCase getCurrentUserUseCase;
    private final CompleteOnboardingUseCase completeOnboardingUseCase;
    private final UpdateLanguagesUseCase updateLanguagesUseCase;

    @GetMapping("/me")
    public ResponseEntity<UserResponse> getMe(@AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(UserResponse.from(getCurrentUserUseCase.get(userId)));
    }

    @PatchMapping("/me/onboarding")
    public ResponseEntity<UserResponse> completeOnboarding(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody OnboardingRequest request
    ) {
        var command = new CompleteOnboardingUseCase.Command(
                userId,
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
}
