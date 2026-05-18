package me.yeonjae.tonebridge.adapter.in.web.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record SubmitTextRequestDto(
        @NotBlank String targetLanguage,
        String targetVariant,
        @NotBlank String contentText,
        String context,
        List<String> feedbackGoals
) {}
