package me.yeonjae.tonebridge.adapter.in.web.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import me.yeonjae.tonebridge.domain.correction.TimestampComment;

import java.util.List;
import java.util.UUID;

public record SubmitCorrectionDto(
        @NotNull UUID requestId,
        String correctedText,
        @NotBlank String explanation,
        List<String> tags,
        List<TimestampComment> timestampComments,
        @Min(1) @Max(10) Integer pronunciationScore,
        @Min(1) @Max(10) Integer intonationScore,
        @Min(1) @Max(10) Integer fluencyScore,
        @Pattern(
                regexp = "^audio/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-zA-Z0-9._-]+$",
                message = "유효하지 않은 오디오 키 형식입니다"
        ) String referenceAudioUrl
) {}
