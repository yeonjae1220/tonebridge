package me.yeonjae.tonebridge.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.AdminPort;
import me.yeonjae.tonebridge.domain.admin.AdminStats;
import me.yeonjae.tonebridge.domain.admin.AdminUserSummary;
import me.yeonjae.tonebridge.domain.correction.CorrectionStatus;
import me.yeonjae.tonebridge.domain.correction.RequestStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class AdminJpaAdapter implements AdminPort {

    private final CorrectionRequestJpaRepository correctionRequestJpaRepository;
    private final CorrectionJpaRepository correctionJpaRepository;
    private final UserJpaRepository userJpaRepository;

    @Override
    @Transactional(readOnly = true)
    public AdminStats getStats() {
        long total = correctionRequestJpaRepository.count();
        long pending = correctionRequestJpaRepository.countByStatus(RequestStatus.PENDING);
        long completed = correctionRequestJpaRepository.countByStatus(RequestStatus.COMPLETED);

        long approved = correctionJpaRepository.countByStatus(CorrectionStatus.APPROVED);
        long rejected = correctionJpaRepository.countByStatus(CorrectionStatus.REJECTED);
        long aiChecked = approved + rejected;
        double passRate = aiChecked > 0 ? (double) approved / aiChecked : 0.0;

        Map<String, Long> pendingByLanguage = new LinkedHashMap<>();
        correctionRequestJpaRepository.countPendingGroupedByLanguage()
                .forEach(row -> pendingByLanguage.put((String) row[0], (Long) row[1]));

        return new AdminStats(total, pending, completed, passRate, pendingByLanguage);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AdminUserSummary> listUsers(int page, int size) {
        return userJpaRepository.findAll(
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        ).map(e -> new AdminUserSummary(
                e.getId(), e.getEmail(), e.getUsername(), e.getNativeLanguage(),
                e.getCredits(), e.getReputationScore(), e.getCorrectionStreak(),
                e.isAdmin(), e.getCreatedAt()
        ));
    }

    @Override
    @Transactional
    public void adjustUserCredits(UUID userId, int delta) {
        userJpaRepository.adjustCredits(userId, delta);
    }
}
