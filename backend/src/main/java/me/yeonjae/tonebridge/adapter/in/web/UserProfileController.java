package me.yeonjae.tonebridge.adapter.in.web;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.adapter.in.web.dto.UserProfileResponse;
import me.yeonjae.tonebridge.application.port.in.GetUserProfileUseCase;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserProfileController {

    private final GetUserProfileUseCase getProfileUseCase;

    @GetMapping("/me/profile")
    public ResponseEntity<UserProfileResponse> getMyProfile(
            @AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(UserProfileResponse.from(getProfileUseCase.getProfile(userId)));
    }
}
