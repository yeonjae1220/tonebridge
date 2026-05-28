package me.yeonjae.tonebridge.adapter.in.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import me.yeonjae.tonebridge.domain.correction.TimestampComment;

import java.util.List;

public record UpdateCorrectionDto(
        String correctedText,
        @NotBlank String explanation,
        List<String> tags,
        List<TimestampComment> timestampComments,
        @Min(0) @Max(100) Integer pronunciationScore,
        @Min(0) @Max(100) Integer intonationScore,
        @Min(0) @Max(100) Integer fluencyScore,
        String referenceAudioUrl
) {}
