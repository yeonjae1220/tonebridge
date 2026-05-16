package me.yeonjae.tonebridge.adapter.in.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public record SubmitCorrectionDto(
        @NotNull UUID requestId,
        @NotBlank String correctedText,
        @NotBlank String explanation,
        List<String> tags
) {}
