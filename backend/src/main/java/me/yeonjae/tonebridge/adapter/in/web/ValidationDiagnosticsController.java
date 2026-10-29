package me.yeonjae.tonebridge.adapter.in.web;

import io.micrometer.core.instrument.MeterRegistry;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Authenticated, bounded aggregate counters. No raw event persistence or user labels. */
@RestController
@RequestMapping("/api/validation/diagnostics")
public class ValidationDiagnosticsController {
    public enum Event { RECORDING_ATTEMPT, RECORDING_SUCCEEDED, RECORDING_FAILED, MICROPHONE_DENIED,
        UPLOAD_ATTEMPT, UPLOAD_SUCCEEDED, UPLOAD_FAILED }
    public record Request(@NotNull Event event) {}
    private final MeterRegistry registry;
    private final boolean enabled;
    private long windowStart = System.nanoTime();
    private int count;

    public ValidationDiagnosticsController(MeterRegistry registry,
            @Value("${tonebridge.validation.enabled:false}") boolean enabled) {
        this.registry = registry;
        this.enabled = enabled;
    }

    @PostMapping
    public ResponseEntity<Void> record(@Valid @RequestBody Request request) {
        if (!enabled) return ResponseEntity.noContent().build();
        if (!acquire()) return ResponseEntity.status(429).build();
        registry.counter("tonebridge.validation.client", "event", request.event().name()).increment();
        return ResponseEntity.noContent().build();
    }

    // Global bound avoids retaining a map of identifiers; counters are advisory, not billing data.
    private synchronized boolean acquire() {
        long now = System.nanoTime();
        if (now - windowStart >= 60_000_000_000L) { windowStart = now; count = 0; }
        return ++count <= 600;
    }
}
