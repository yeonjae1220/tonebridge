package me.yeonjae.tonebridge.application.port.out;

import me.yeonjae.tonebridge.domain.admin.AdminStats;
import me.yeonjae.tonebridge.domain.admin.AdminUserSummary;
import org.springframework.data.domain.Page;

import java.util.UUID;

public interface AdminPort {
    AdminStats getStats();
    Page<AdminUserSummary> listUsers(int page, int size);
    void adjustUserCredits(UUID userId, int delta);
}
