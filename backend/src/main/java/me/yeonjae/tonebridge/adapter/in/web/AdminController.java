package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.yeonjae.tonebridge.application.service.AdminService;
import me.yeonjae.tonebridge.domain.admin.AdminStats;
import me.yeonjae.tonebridge.domain.admin.AdminUserSummary;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Validated
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/stats")
    public ResponseEntity<AdminStats> getStats() {
        return ResponseEntity.ok(adminService.getStats());
    }

    @GetMapping("/users")
    public ResponseEntity<Page<AdminUserSummary>> listUsers(
            @AuthenticationPrincipal UUID adminId,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        log.info("Admin user list accessed: adminId={}, page={}, size={}", adminId, page, size);
        return ResponseEntity.ok(adminService.listUsers(page, size));
    }

    @PatchMapping("/users/{userId}/credits")
    public ResponseEntity<Void> adjustCredits(
            @AuthenticationPrincipal UUID adminId,
            @PathVariable UUID userId,
            @RequestParam @Min(-10_000) @Max(10_000) int delta) {
        log.info("Admin credit adjustment: adminId={}, targetUserId={}, delta={}", adminId, userId, delta);
        adminService.adjustUserCredits(userId, delta);
        return ResponseEntity.noContent().build();
    }
}
