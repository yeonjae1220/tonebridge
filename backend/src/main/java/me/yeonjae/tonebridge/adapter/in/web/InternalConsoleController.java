package me.yeonjae.tonebridge.adapter.in.web;

import me.yeonjae.tonebridge.application.service.AdminService;
import me.yeonjae.tonebridge.domain.admin.AdminStats;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Read-only summary consumed by the lab.mungji console aggregator. Returns
 * aggregate counts only (no PII), gated by {@code ServiceTokenAuthFilter} on the
 * {@code /api/internal/**} security chain.
 */
@RestController
@RequestMapping("/api/internal/console")
public class InternalConsoleController {

    private final AdminService adminService;

    public InternalConsoleController(AdminService adminService) {
        this.adminService = adminService;
    }

    @GetMapping("/summary")
    public Map<String, Object> summary() {
        AdminStats stats = adminService.getStats();
        long totalUsers = adminService.listUsers(0, 1).getTotalElements();
        return Map.of(
                "totalUsers", totalUsers,
                "usage", List.of(
                        Map.of("label", "교정요청", "value", stats.totalRequests()),
                        Map.of("label", "완료", "value", stats.completedRequests()),
                        Map.of("label", "대기", "value", stats.pendingRequests())
                ));
    }
}
