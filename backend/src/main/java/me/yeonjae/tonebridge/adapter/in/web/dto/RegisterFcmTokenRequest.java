package me.yeonjae.tonebridge.adapter.in.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import me.yeonjae.tonebridge.domain.user.Platform;

public record RegisterFcmTokenRequest(
        @NotBlank String token,
        @NotNull Platform platform
) {}
