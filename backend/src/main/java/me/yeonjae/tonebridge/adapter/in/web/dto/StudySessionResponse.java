package me.yeonjae.tonebridge.adapter.in.web.dto;

import me.yeonjae.tonebridge.domain.session.StudySession;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record StudySessionResponse(
        UUID id,
        String title,
        UUID createdBy,
        List<UUID> memberIds,
        String status,
        Instant createdAt
) {
    public static StudySessionResponse from(StudySession s) {
        return new StudySessionResponse(s.id(), s.title(), s.createdBy(),
                s.memberIds(), s.status().name(), s.createdAt());
    }
}
