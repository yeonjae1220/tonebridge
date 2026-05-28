package me.yeonjae.tonebridge.adapter.out.persistence;

import jakarta.persistence.*;
import lombok.*;
import me.yeonjae.tonebridge.domain.session.SessionStatus;
import me.yeonjae.tonebridge.domain.session.StudySession;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "study_sessions")
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudySessionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private String title;

    @Column(nullable = false)
    private UUID createdBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SessionStatus status;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    private Instant deletedAt;

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<SessionMemberEntity> members = new ArrayList<>();

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (updatedAt == null) updatedAt = createdAt;
        if (status == null) status = SessionStatus.ACTIVE;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }

    /** Mutate status in-place for update operations (preserves the members collection). */
    public void updateStatus(SessionStatus newStatus) {
        this.status = newStatus;
    }

    public void updateTitle(String newTitle) {
        this.title = newTitle;
    }

    public void softDelete() {
        if (deletedAt == null) {
            deletedAt = Instant.now();
        }
    }

    public StudySession toDomain() {
        List<UUID> memberIds = members.stream().map(SessionMemberEntity::getUserId).toList();
        return new StudySession(id, title, createdBy, memberIds, status, createdAt);
    }

    public static StudySessionEntity fromDomain(StudySession s) {
        return StudySessionEntity.builder()
                .id(s.id())
                .title(s.title())
                .createdBy(s.createdBy())
                .status(s.status())
                .createdAt(s.createdAt())
                .updatedAt(s.createdAt())
                .build();
    }
}
