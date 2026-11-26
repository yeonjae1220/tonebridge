package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.service.ContentReportService;
import me.yeonjae.tonebridge.application.service.ContentReportService.Reason;
import me.yeonjae.tonebridge.application.service.ContentReportService.TargetType;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ContentReportController {

    private final ContentReportService reports;

    record ReportRequest(@NotNull TargetType targetType, @NotNull UUID targetId, @NotNull Reason reason,
                         @Size(max = 500) String detail, Boolean alsoBlock) {}

    record ReportResponse(UUID id) {}

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReportResponse report(@AuthenticationPrincipal UUID reporter, @Valid @RequestBody ReportRequest request) {
        UUID id = reports.report(new ContentReportService.Command(reporter, request.targetType(), request.targetId(),
                request.reason(), request.detail(), Boolean.TRUE.equals(request.alsoBlock())));
        return new ReportResponse(id);
    }
}
