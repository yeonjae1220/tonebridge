package me.yeonjae.tonebridge.adapter.out.persistence;

import jakarta.persistence.*;
import lombok.*;
import me.yeonjae.tonebridge.domain.correction.CorrectionRequest;
import me.yeonjae.tonebridge.domain.correction.CorrectionType;
import me.yeonjae.tonebridge.domain.correction.RequestStatus;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Entity
@Table(name = "correction_requests")
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CorrectionRequestEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID requesterId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CorrectionType type;

    @Column(columnDefinition = "TEXT")
    private String contentText;

    private String audioUrl;

    @Column(nullable = false)
    private String targetLanguage;

    private String targetVariant;

    @Column(columnDefinition = "TEXT")
    private String context;

    @Column(name = "feedback_goals", length = 512)
    private String feedbackGoalsRaw;

    @Column(nullable = false)
    private int creditCost;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RequestStatus status;

    @Column(columnDefinition = "TEXT")
    private String aiCorrection;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant expiresAt;

    @Column(nullable = false)
    private Instant updatedAt;

    private Instant deletedAt;

    @Column(nullable = false)
    private int editCount;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (updatedAt == null) updatedAt = createdAt;
        if (expiresAt == null) expiresAt = createdAt.plusSeconds(48 * 3600L);
        if (status == null) status = RequestStatus.PENDING;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }

    public void updateContent(String targetLanguage, String targetVariant, String contentText,
                              String context, List<String> feedbackGoals) {
        this.targetLanguage = targetLanguage;
        this.targetVariant = targetVariant;
        this.contentText = contentText;
        this.context = context;
        this.feedbackGoalsRaw = joinList(feedbackGoals);
        this.editCount++;
    }

    public void softDelete() {
        if (deletedAt == null) {
            deletedAt = Instant.now();
        }
    }

    public CorrectionRequest toDomain() {
        return new CorrectionRequest(
                id, requesterId, type, contentText, audioUrl, targetLanguage, targetVariant,
                context, parseList(feedbackGoalsRaw), creditCost, status, aiCorrection, createdAt, expiresAt
        );
    }

    public static CorrectionRequestEntity fromDomain(CorrectionRequest r) {
        return CorrectionRequestEntity.builder()
                .id(r.id())
                .requesterId(r.requesterId())
                .type(r.type())
                .contentText(r.contentText())
                .audioUrl(r.audioUrl())
                .targetLanguage(r.targetLanguage())
                .targetVariant(r.targetVariant())
                .context(r.context())
                .feedbackGoalsRaw(joinList(r.feedbackGoals()))
                .creditCost(r.creditCost())
                .status(r.status())
                .aiCorrection(r.aiCorrection())
                .createdAt(r.createdAt())
                .expiresAt(r.expiresAt())
                .updatedAt(r.createdAt())
                .build();
    }

    private static List<String> parseList(String raw) {
        if (raw == null || raw.isBlank()) return new ArrayList<>();
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toCollection(ArrayList::new));
    }

    private static String joinList(List<String> list) {
        if (list == null || list.isEmpty()) return "";
        return String.join(",", list);
    }
}
