package me.yeonjae.tonebridge.adapter.out.persistence;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.*;
import lombok.*;
import me.yeonjae.tonebridge.domain.correction.Correction;
import me.yeonjae.tonebridge.domain.correction.CorrectionStatus;
import me.yeonjae.tonebridge.domain.correction.TimestampComment;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Entity
@Table(name = "corrections")
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CorrectionEntity {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<TimestampComment>> TIMESTAMP_TYPE = new TypeReference<>() {};

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID requestId;

    private UUID correctorId;

    @Column(nullable = false)
    private boolean isAi;

    @Column(columnDefinition = "TEXT")
    private String correctedText;

    @Column(columnDefinition = "TEXT")
    private String explanation;

    @Column(name = "tags", length = 512)
    private String tagsRaw;

    @Column(columnDefinition = "TEXT")
    private String timestampCommentsJson;

    private Integer pronunciationScore;
    private Integer intonationScore;
    private Integer fluencyScore;

    @Column(length = 500)
    private String referenceAudioUrl;

    @Column(nullable = false)
    private int creditEarned;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CorrectionStatus status;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (status == null) status = CorrectionStatus.SUBMITTED;
    }

    public Correction toDomain() {
        return new Correction(
                id, requestId, correctorId, isAi,
                correctedText, explanation, parseList(tagsRaw),
                parseTimestampComments(timestampCommentsJson),
                pronunciationScore, intonationScore, fluencyScore,
                referenceAudioUrl, creditEarned, status, createdAt
        );
    }

    public static CorrectionEntity fromDomain(Correction c) {
        return CorrectionEntity.builder()
                .id(c.id())
                .requestId(c.requestId())
                .correctorId(c.correctorId())
                .isAi(c.isAi())
                .correctedText(c.correctedText())
                .explanation(c.explanation())
                .tagsRaw(joinList(c.tags()))
                .timestampCommentsJson(serializeTimestampComments(c.timestampComments()))
                .pronunciationScore(c.pronunciationScore())
                .intonationScore(c.intonationScore())
                .fluencyScore(c.fluencyScore())
                .referenceAudioUrl(c.referenceAudioUrl())
                .creditEarned(c.creditEarned())
                .status(c.status())
                .createdAt(c.createdAt())
                .build();
    }

    private static List<TimestampComment> parseTimestampComments(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return List.copyOf(MAPPER.readValue(json, TIMESTAMP_TYPE));
        } catch (Exception e) {
            return List.of();
        }
    }

    private static String serializeTimestampComments(List<TimestampComment> comments) {
        if (comments == null || comments.isEmpty()) return null;
        try {
            return MAPPER.writeValueAsString(comments);
        } catch (Exception e) {
            return null;
        }
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
