package me.yeonjae.tonebridge.adapter.in.web.dto;

public record MobileAuthResponse(
        String accessToken,
        String refreshToken,
        boolean needsOnboarding,
        UserResponse user
) {}
