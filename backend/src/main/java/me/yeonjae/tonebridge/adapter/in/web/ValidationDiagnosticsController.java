package me.yeonjae.tonebridge.adapter.in.web;

import io.micrometer.core.instrument.MeterRegistry;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import me.yeonjae.tonebridge.adapter.out.persistence.ValidationDiagnosticRecorder;
import me.yeonjae.tonebridge.shared.event.ValidationDiagnostic;
import org.springframework.dao.DataAccessException;
import org.springframework.transaction.TransactionException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** Authenticated, bounded aggregate counters. No raw event persistence or user labels. */
@RestController
@RequestMapping("/api/validation/diagnostics")
public class ValidationDiagnosticsController {
    public record Request(@NotNull ValidationDiagnostic event) {}
    private final MeterRegistry registry;
    private final ValidationDiagnosticRecorder recorder;

    public ValidationDiagnosticsController(MeterRegistry registry, ValidationDiagnosticRecorder recorder) {
        this.registry = registry;
        this.recorder = recorder;
    }

    @PostMapping
    public ResponseEntity<Void> record(@AuthenticationPrincipal UUID userId, @Valid @RequestBody Request request) {
        final ValidationDiagnosticRecorder.Result result;
        try {
            result = recorder.record(userId, request.event());
        } catch (DataAccessException | TransactionException e) {
            // The client must not retry or interrupt learning. Do not log SQL values or request content.
            return ResponseEntity.status(503).build();
        }
        if (result == ValidationDiagnosticRecorder.Result.RATE_LIMITED) return ResponseEntity.status(429).build();
        if (result == ValidationDiagnosticRecorder.Result.RECORDED) {
            // Optional process-local monitoring only; reporting reads the committed daily table.
            registry.counter("tonebridge.validation.client", "event", request.event().name()).increment();
        }
        // Do not reveal whether this account is enrolled.
        return ResponseEntity.noContent().build();
    }
}
