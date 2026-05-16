package me.yeonjae.tonebridge.adapter.in.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record OnboardingRequest(
        @NotBlank String nativeLanguage,
        @NotNull List<String> fluentLanguages,
        @NotNull List<String> learningLanguages
) {}
