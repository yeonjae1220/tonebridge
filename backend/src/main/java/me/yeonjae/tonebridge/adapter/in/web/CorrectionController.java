package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.adapter.in.web.dto.CorrectionResponse;
import me.yeonjae.tonebridge.adapter.in.web.dto.RateCorrectionDto;
import me.yeonjae.tonebridge.adapter.in.web.dto.SubmitCorrectionDto;
import me.yeonjae.tonebridge.application.port.in.GetCorrectionResultUseCase;
import me.yeonjae.tonebridge.application.port.in.RateCorrectionUseCase;
import me.yeonjae.tonebridge.application.port.in.SubmitCorrectionUseCase;
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

    @PostMapping
    public ResponseEntity<CorrectionResponse> submit(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody SubmitCorrectionDto dto) {
        var result = submitUseCase.submit(new SubmitCorrectionUseCase.Command(
                dto.requestId(), userId, dto.correctedText(), dto.explanation(), dto.tags()
        ));
        return ResponseEntity.status(HttpStatus.CREATED).body(CorrectionResponse.from(result));
    }

    @GetMapping("/request/{requestId}")
    public ResponseEntity<List<CorrectionResponse>> result(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID requestId) {
        return ResponseEntity.ok(resultUseCase.getResult(requestId, userId)
                .stream().map(CorrectionResponse::from).toList());
    }

    @PostMapping("/{correctionId}/rate")
    public ResponseEntity<Void> rate(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID correctionId,
            @RequestBody RateCorrectionDto dto) {
        rateUseCase.rate(new RateCorrectionUseCase.Command(correctionId, userId, dto.helpful()));
        return ResponseEntity.noContent().build();
    }
}
