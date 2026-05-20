package me.yeonjae.tonebridge.adapter.out.persistence;

import jakarta.persistence.*;
import lombok.*;
import me.yeonjae.tonebridge.domain.studycard.StudyCard;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Entity
@Table(name = "study_cards")
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudyCardEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID sessionId;

    @Column(nullable = false)
    private UUID createdByUserId;

    @Column(nullable = false, length = 500)
    private String phrase;

    @Column(columnDefinition = "TEXT")
    private String context;

    @Column(length = 500)
    private String nativeAudioUrl;

    @Column(columnDefinition = "TEXT")
    private String explanation;

    @Column(name = "tags", length = 500)
    private String tagsRaw;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (tagsRaw == null) tagsRaw = "";
    }

    public StudyCard toDomain() {
        return new StudyCard(id, sessionId, createdByUserId, phrase, context,
                nativeAudioUrl, explanation, parseList(tagsRaw), createdAt, null);
    }

    public static StudyCardEntity fromDomain(StudyCard c) {
        return StudyCardEntity.builder()
                .id(c.id())
                .sessionId(c.sessionId())
                .createdByUserId(c.createdByUserId())
                .phrase(c.phrase())
                .context(c.context())
                .nativeAudioUrl(c.nativeAudioUrl())
                .explanation(c.explanation())
                .tagsRaw(joinList(c.tags()))
                .createdAt(c.createdAt())
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
