package me.yeonjae.tonebridge.adapter.out.persistence;

import jakarta.persistence.*;
import lombok.*;
import me.yeonjae.tonebridge.domain.user.CorrectorLevel;
import me.yeonjae.tonebridge.domain.user.User;

import java.time.LocalDate;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Entity
@Table(name = "users")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(nullable = false)
    private String nativeLanguage;

    @Column(name = "fluent_languages", length = 1024)
    private String fluentLanguagesRaw;

    @Column(name = "learning_languages", length = 1024)
    private String learningLanguagesRaw;

    @Column(nullable = false)
    private int credits;

    @Column(nullable = false)
    private double reputationScore;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CorrectorLevel correctorLevel;

    @Column(nullable = false)
    private int correctionStreak;

    private LocalDate lastCorrectionDate;

    @Version
    private Long version;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private boolean isAdmin;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }

    public User toDomain() {
        return new User(id, email, username, nativeLanguage,
                parseList(fluentLanguagesRaw),
                parseList(learningLanguagesRaw),
                credits, reputationScore, correctorLevel,
                correctionStreak, lastCorrectionDate, createdAt, isAdmin);
    }

    public static UserEntity fromDomain(User user) {
        return UserEntity.builder()
                .id(user.id())
                .email(user.email())
                .username(user.username())
                .nativeLanguage(user.nativeLanguage())
                .fluentLanguagesRaw(joinList(user.fluentLanguages()))
                .learningLanguagesRaw(joinList(user.learningLanguages()))
                .credits(user.credits())
                .reputationScore(user.reputationScore())
                .correctorLevel(user.correctorLevel())
                .correctionStreak(user.correctionStreak())
                .lastCorrectionDate(user.lastCorrectionDate())
                .createdAt(user.createdAt())
                .isAdmin(user.isAdmin())
                .build();
    }

    public void updateFrom(User user) {
        this.nativeLanguage = user.nativeLanguage();
        this.fluentLanguagesRaw = joinList(user.fluentLanguages());
        this.learningLanguagesRaw = joinList(user.learningLanguages());
        this.credits = user.credits();
        this.reputationScore = user.reputationScore();
        this.correctorLevel = user.correctorLevel();
        this.correctionStreak = user.correctionStreak();
        this.lastCorrectionDate = user.lastCorrectionDate();
        this.isAdmin = user.isAdmin();
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
