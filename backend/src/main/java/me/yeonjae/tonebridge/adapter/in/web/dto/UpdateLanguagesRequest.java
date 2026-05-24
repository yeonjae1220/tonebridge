package me.yeonjae.tonebridge.adapter.in.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

public record UpdateLanguagesRequest(
        @NotBlank @Size(max = 30) @Pattern(regexp = "^[a-zA-Z0-9_-]+$") String nativeLanguage,
        @Size(max = 30) @Pattern(regexp = "^[a-zA-Z0-9_-]+$") String nativeDialect,
        @NotNull List<@NotBlank @Size(max = 30) @Pattern(regexp = "^[a-zA-Z0-9_-]+$") String> fluentLanguages,
        @NotNull List<@NotBlank @Size(max = 30) @Pattern(regexp = "^[a-zA-Z0-9_-]+$") String> learningLanguages,
        @Size(max = 20) Map<
                @Size(max = 30) @Pattern(regexp = "^[a-zA-Z0-9_-]+$") String,
                @Size(max = 30) @Pattern(regexp = "^[a-zA-Z0-9_-]+$") String> fluentLanguageVariants,
        @Size(max = 20) Map<
                @Size(max = 30) @Pattern(regexp = "^[a-zA-Z0-9_-]+$") String,
                @Size(max = 30) @Pattern(regexp = "^[a-zA-Z0-9_-]+$") String> learningLanguageVariants
) {}
