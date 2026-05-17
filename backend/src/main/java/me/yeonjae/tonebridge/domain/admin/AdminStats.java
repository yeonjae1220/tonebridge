package me.yeonjae.tonebridge.domain.admin;

import java.util.Map;

public record AdminStats(
        long totalRequests,
        long pendingRequests,
        long completedRequests,
        double qualityPassRate,
        Map<String, Long> pendingByLanguage
) {}
