package me.yeonjae.tonebridge.adapter.in.web.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record SubmitAudioRequestDto(
        @NotBlank String targetLanguage,
        @NotBlank String audioKey,
        String context,
        List<String> feedbackGoals
) {}
