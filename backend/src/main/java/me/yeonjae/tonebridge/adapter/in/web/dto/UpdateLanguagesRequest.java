package me.yeonjae.tonebridge.adapter.in.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record UpdateLanguagesRequest(
        @NotBlank @Size(max = 30) @Pattern(regexp = "^[a-zA-Z0-9_-]+$") String nativeLanguage,
        @NotNull List<@NotBlank @Size(max = 30) @Pattern(regexp = "^[a-zA-Z0-9_-]+$") String> fluentLanguages,
        @NotNull List<@NotBlank @Size(max = 30) @Pattern(regexp = "^[a-zA-Z0-9_-]+$") String> learningLanguages
) {}
