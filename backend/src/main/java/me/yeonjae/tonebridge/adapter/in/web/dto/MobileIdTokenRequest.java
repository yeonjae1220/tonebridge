package me.yeonjae.tonebridge.adapter.in.web.dto;

import jakarta.validation.constraints.NotBlank;

public record MobileIdTokenRequest(@NotBlank String idToken) {}
