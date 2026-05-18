package me.yeonjae.tonebridge.adapter.in.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import java.util.List;

public record SubmitAudioRequestDto(
        @NotBlank String targetLanguage,
        String targetVariant,
        @NotBlank @Pattern(
                regexp = "^audio/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-zA-Z0-9._-]+$",
                message = "유효하지 않은 오디오 키 형식입니다"
        ) String audioKey,
        String context,
        List<String> feedbackGoals
) {}
