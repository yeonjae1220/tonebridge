package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.AdminPort;
import me.yeonjae.tonebridge.domain.admin.AdminStats;
import me.yeonjae.tonebridge.domain.admin.AdminUserSummary;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final AdminPort adminPort;

    @Transactional(readOnly = true)
    public AdminStats getStats() {
        return adminPort.getStats();
    }

    @Transactional(readOnly = true)
    public Page<AdminUserSummary> listUsers(int page, int size) {
        return adminPort.listUsers(page, size);
    }

    @Transactional
    public void adjustUserCredits(UUID userId, int delta) {
        adminPort.adjustUserCredits(userId, delta);
    }
}
