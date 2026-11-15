package me.yeonjae.tonebridge.adapter.in.web;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.service.SubmissionService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/submissions")
@RequiredArgsConstructor
public class SubmissionController {
    private final SubmissionService service;
    @GetMapping("/{operation}")
    public SubmissionService.Result status(@AuthenticationPrincipal UUID owner, @PathVariable UUID operation) {
        return service.status(owner, operation);
    }
    @PostMapping("/{operation}/cancel")
    public SubmissionService.Result cancel(@AuthenticationPrincipal UUID owner, @PathVariable UUID operation) {
        return service.cancel(owner, operation);
    }
}
