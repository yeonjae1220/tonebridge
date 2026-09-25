package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.adapter.in.web.dto.CorrectionRequestResponse;
import me.yeonjae.tonebridge.adapter.in.web.dto.FeedPageResponse;
import me.yeonjae.tonebridge.adapter.in.web.dto.SubmitAudioRequestDto;
import me.yeonjae.tonebridge.adapter.in.web.dto.SubmitTextRequestDto;
import me.yeonjae.tonebridge.adapter.in.web.dto.UpdateCorrectionRequestDto;
import me.yeonjae.tonebridge.application.port.in.DeleteCorrectionRequestUseCase;
import me.yeonjae.tonebridge.application.port.in.GetCorrectionFeedUseCase;
import me.yeonjae.tonebridge.application.port.in.GetCorrectionRequestUseCase;
import me.yeonjae.tonebridge.application.port.in.GetMyCorrectionRequestsUseCase;
import me.yeonjae.tonebridge.application.port.in.SubmitAudioCorrectionRequestUseCase;
import me.yeonjae.tonebridge.application.port.in.SubmitTextCorrectionRequestUseCase;
import me.yeonjae.tonebridge.application.port.in.UpdateCorrectionRequestUseCase;
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
    private final GetCorrectionRequestUseCase getRequestUseCase;
    private final GetMyCorrectionRequestsUseCase myUseCase;
    private final UpdateCorrectionRequestUseCase updateUseCase;
    private final DeleteCorrectionRequestUseCase deleteUseCase;

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

    /**
     * 커서 페이지네이션 피드. 다음 페이지는 응답의 {@code nextCursor} 를 {@code before} 로 넘긴다.
     */
    @GetMapping("/feed/page")
    public ResponseEntity<FeedPageResponse> feedPage(
            @AuthenticationPrincipal UUID userId,
            @RequestParam(required = false) String before,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        GetCorrectionFeedUseCase.FeedCursor cursor =
                before == null || before.isBlank() ? null : GetCorrectionFeedUseCase.FeedCursor.decode(before);
        return ResponseEntity.ok(FeedPageResponse.from(feedUseCase.getFeedPage(userId, cursor, limit)));
    }

    /** 옛 배열 응답 — 설치된 구버전 모바일 앱용. 첫 페이지만 준다. 새 코드는 {@code /feed/page}. */
    @Deprecated
    @GetMapping("/feed")
    public ResponseEntity<List<CorrectionRequestResponse>> feed(
            @AuthenticationPrincipal UUID userId,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return ResponseEntity.ok(feedUseCase.getFeed(userId, limit)
                .stream().map(CorrectionRequestResponse::from).toList());
    }

    @GetMapping("/{requestId}")
    public ResponseEntity<CorrectionRequestResponse> get(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID requestId) {
        return ResponseEntity.ok(CorrectionRequestResponse.from(getRequestUseCase.get(requestId, userId)));
    }

    @GetMapping("/mine")
    public ResponseEntity<List<CorrectionRequestResponse>> mine(@AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(myUseCase.getMine(userId)
                .stream().map(CorrectionRequestResponse::from).toList());
    }

    @PatchMapping("/{requestId}")
    public ResponseEntity<CorrectionRequestResponse> update(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID requestId,
            @Valid @RequestBody UpdateCorrectionRequestDto dto) {
        var result = updateUseCase.update(new UpdateCorrectionRequestUseCase.Command(
                requestId, userId, dto.targetLanguage(), dto.targetVariant(),
                dto.contentText(), dto.context(), dto.feedbackGoals()
        ));
        return ResponseEntity.ok(CorrectionRequestResponse.from(result));
    }

    @DeleteMapping("/{requestId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID requestId) {
        deleteUseCase.delete(requestId, userId);
        return ResponseEntity.noContent().build();
    }
}
