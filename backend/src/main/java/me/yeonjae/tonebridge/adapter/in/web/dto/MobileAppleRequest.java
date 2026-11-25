package me.yeonjae.tonebridge.adapter.in.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Identity token (JWT) returned by Sign in with Apple on the device. */
public record MobileAppleRequest(@NotBlank @Size(max = 8192) String identityToken) {}
