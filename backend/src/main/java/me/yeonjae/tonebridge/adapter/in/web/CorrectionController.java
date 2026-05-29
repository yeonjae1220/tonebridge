package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.adapter.in.web.dto.CorrectionResponse;
import me.yeonjae.tonebridge.adapter.in.web.dto.RateCorrectionDto;
import me.yeonjae.tonebridge.adapter.in.web.dto.SubmitCorrectionDto;
import me.yeonjae.tonebridge.adapter.in.web.dto.UpdateCorrectionDto;
import me.yeonjae.tonebridge.domain.correction.CorrectionWithStats;
import me.yeonjae.tonebridge.application.port.in.AcceptCorrectionUseCase;
import me.yeonjae.tonebridge.application.port.in.DeleteCorrectionUseCase;
import me.yeonjae.tonebridge.application.port.in.GetCorrectionResultUseCase;
import me.yeonjae.tonebridge.application.port.in.LikeCorrectionUseCase;
import me.yeonjae.tonebridge.application.port.in.RateCorrectionUseCase;
import me.yeonjae.tonebridge.application.port.in.SubmitCorrectionUseCase;
import me.yeonjae.tonebridge.application.port.in.UpdateCorrectionUseCase;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/corrections")
@RequiredArgsConstructor
public class CorrectionController {

    private final SubmitCorrectionUseCase submitUseCase;
    private final RateCorrectionUseCase rateUseCase;
    private final GetCorrectionResultUseCase resultUseCase;
    private final UpdateCorrectionUseCase updateUseCase;
    private final DeleteCorrectionUseCase deleteUseCase;
    private final AcceptCorrectionUseCase acceptUseCase;
    private final LikeCorrectionUseCase likeUseCase;

    @PostMapping
    public ResponseEntity<CorrectionResponse> submit(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody SubmitCorrectionDto dto) {
        var result = submitUseCase.submit(new SubmitCorrectionUseCase.Command(
                dto.requestId(), userId,
                dto.correctedText(), dto.explanation(), dto.tags(),
                dto.timestampComments(), dto.pronunciationScore(), dto.intonationScore(),
                dto.fluencyScore(), dto.referenceAudioUrl()
        ));
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(CorrectionResponse.from(new CorrectionWithStats(result, 0, false, false)));
    }

    @GetMapping("/request/{requestId}")
    public ResponseEntity<List<CorrectionResponse>> result(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID requestId) {
        return ResponseEntity.ok(resultUseCase.getResult(requestId, userId)
                .stream().map(CorrectionResponse::from).toList());
    }

    @PostMapping("/{correctionId}/accept")
    public ResponseEntity<Void> accept(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID correctionId) {
        acceptUseCase.accept(new AcceptCorrectionUseCase.Command(correctionId, userId));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{correctionId}/like")
    public ResponseEntity<LikeCorrectionUseCase.Result> like(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID correctionId) {
        return ResponseEntity.ok(likeUseCase.toggleLike(new LikeCorrectionUseCase.Command(correctionId, userId)));
    }

    @PostMapping("/{correctionId}/rate")
    public ResponseEntity<Void> rate(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID correctionId,
            @Valid @RequestBody RateCorrectionDto dto) {
        rateUseCase.rate(new RateCorrectionUseCase.Command(correctionId, userId, dto.helpful()));
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{correctionId}")
    public ResponseEntity<CorrectionResponse> update(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID correctionId,
            @Valid @RequestBody UpdateCorrectionDto dto) {
        var result = updateUseCase.update(new UpdateCorrectionUseCase.Command(
                correctionId, userId,
                dto.correctedText(), dto.explanation(), dto.tags(),
                dto.timestampComments(), dto.pronunciationScore(), dto.intonationScore(),
                dto.fluencyScore(), dto.referenceAudioUrl()
        ));
        return ResponseEntity.ok(CorrectionResponse.from(new CorrectionWithStats(result, 0, false, false)));
    }

    @DeleteMapping("/{correctionId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID correctionId) {
        deleteUseCase.delete(correctionId, userId);
        return ResponseEntity.noContent().build();
    }
}
