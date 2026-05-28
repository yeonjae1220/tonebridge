package me.yeonjae.tonebridge.adapter.in.web.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record UpdateCorrectionRequestDto(
        @NotBlank String targetLanguage,
        String targetVariant,
        String contentText,
        String context,
        List<String> feedbackGoals
) {}
