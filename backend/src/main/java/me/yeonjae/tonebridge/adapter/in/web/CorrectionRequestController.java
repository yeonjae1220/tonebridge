package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.adapter.in.web.dto.CorrectionRequestResponse;
import me.yeonjae.tonebridge.adapter.in.web.dto.SubmitAudioRequestDto;
import me.yeonjae.tonebridge.adapter.in.web.dto.SubmitTextRequestDto;
import me.yeonjae.tonebridge.application.port.in.GetCorrectionFeedUseCase;
import me.yeonjae.tonebridge.application.port.in.GetMyCorrectionRequestsUseCase;
import me.yeonjae.tonebridge.application.port.in.SubmitAudioCorrectionRequestUseCase;
import me.yeonjae.tonebridge.application.port.in.SubmitTextCorrectionRequestUseCase;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/correction-requests")
@RequiredArgsConstructor
@Validated
public class CorrectionRequestController {

    private final SubmitTextCorrectionRequestUseCase submitUseCase;
    private final SubmitAudioCorrectionRequestUseCase submitAudioUseCase;
    private final GetCorrectionFeedUseCase feedUseCase;
    private final GetMyCorrectionRequestsUseCase myUseCase;

    @PostMapping
    public ResponseEntity<CorrectionRequestResponse> submit(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody SubmitTextRequestDto dto) {
        var result = submitUseCase.submit(new SubmitTextCorrectionRequestUseCase.Command(
                userId, dto.targetLanguage(), dto.targetVariant(), dto.contentText(), dto.context(), dto.feedbackGoals()
        ));
        return ResponseEntity.status(HttpStatus.CREATED).body(CorrectionRequestResponse.from(result));
    }

    @PostMapping("/audio")
    public ResponseEntity<CorrectionRequestResponse> submitAudio(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody SubmitAudioRequestDto dto) {
        var result = submitAudioUseCase.submit(new SubmitAudioCorrectionRequestUseCase.Command(
                userId, dto.targetLanguage(), dto.targetVariant(), dto.audioKey(), dto.context(), dto.feedbackGoals()
        ));
        return ResponseEntity.status(HttpStatus.CREATED).body(CorrectionRequestResponse.from(result));
    }

    @GetMapping("/feed")
    public ResponseEntity<List<CorrectionRequestResponse>> feed(
            @AuthenticationPrincipal UUID userId,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return ResponseEntity.ok(feedUseCase.getFeed(userId, limit)
                .stream().map(CorrectionRequestResponse::from).toList());
    }

    @GetMapping("/mine")
    public ResponseEntity<List<CorrectionRequestResponse>> mine(@AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(myUseCase.getMine(userId)
                .stream().map(CorrectionRequestResponse::from).toList());
    }
}
