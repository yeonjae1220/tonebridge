package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.in.GetPracticeFeedbackUseCase;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/practice-feedback")
@RequiredArgsConstructor
@Validated
public class PracticeFeedbackController {
    private final GetPracticeFeedbackUseCase feedback;

    @GetMapping
    public ResponseEntity<GetPracticeFeedbackUseCase.Page> get(@AuthenticationPrincipal UUID userId,
            @RequestParam(defaultValue = "0") @Min(0) @Max(10000) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(feedback.getFeedback(userId, page, size));
    }
}
