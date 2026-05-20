package me.yeonjae.tonebridge.domain.session;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record StudySession(
        UUID id,
        String title,
        UUID createdBy,
        List<UUID> memberIds,
        SessionStatus status,
        Instant createdAt
) {
    public boolean hasMember(UUID userId) {
        return memberIds.contains(userId);
    }

    public boolean isActive() {
        return status == SessionStatus.ACTIVE;
    }
}
