package me.yeonjae.tonebridge.adapter.in.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

public record OnboardingRequest(
        @NotBlank String nativeLanguage,
        @Size(max = 30) @Pattern(regexp = "^[a-zA-Z0-9_-]+$") String nativeDialect,
        @NotNull List<String> fluentLanguages,
        @NotNull List<String> learningLanguages,
        Map<String, String> fluentLanguageVariants,
        Map<String, String> learningLanguageVariants
) {}
