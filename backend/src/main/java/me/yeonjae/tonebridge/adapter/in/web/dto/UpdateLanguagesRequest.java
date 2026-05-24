package me.yeonjae.tonebridge.adapter.in.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

public record UpdateLanguagesRequest(
        @NotBlank @Size(max = 30) @Pattern(regexp = "^[a-zA-Z0-9_-]+$") String nativeLanguage,
        @Size(max = 30) @Pattern(regexp = "^[a-zA-Z0-9_-]+$") String nativeDialect,
        // @Size(max = 50) bounds the list to prevent CSV overflow of VARCHAR(1024)
        @NotNull @Size(max = 50) List<@NotBlank @Size(max = 30) @Pattern(regexp = "^[a-zA-Z0-9_-]+$") String> fluentLanguages,
        @NotNull @Size(max = 50) List<@NotBlank @Size(max = 30) @Pattern(regexp = "^[a-zA-Z0-9_-]+$") String> learningLanguages,
        // @Valid enables cascade validation into map key/value type arguments
        @Valid @Size(max = 20) Map<
                @Size(max = 30) @Pattern(regexp = "^[a-zA-Z0-9_-]+$") String,
                @Size(max = 30) @Pattern(regexp = "^[a-zA-Z0-9_-]+$") String> fluentLanguageVariants,
        @Valid @Size(max = 20) Map<
                @Size(max = 30) @Pattern(regexp = "^[a-zA-Z0-9_-]+$") String,
                @Size(max = 30) @Pattern(regexp = "^[a-zA-Z0-9_-]+$") String> learningLanguageVariants
) {}
