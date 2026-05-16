package me.yeonjae.tonebridge.adapter.in.web;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.in.GetCreditHistoryUseCase;
import me.yeonjae.tonebridge.domain.credit.CreditTransaction;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/credits")
@RequiredArgsConstructor
public class CreditController {

    private final GetCreditHistoryUseCase getCreditHistoryUseCase;

    @GetMapping("/history")
    public ResponseEntity<List<CreditTransaction>> history(@AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(getCreditHistoryUseCase.getHistory(userId));
    }
}
