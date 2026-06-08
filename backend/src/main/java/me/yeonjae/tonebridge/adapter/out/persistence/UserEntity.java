package me.yeonjae.tonebridge.adapter.out.persistence;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.*;
import lombok.*;
import lombok.extern.slf4j.Slf4j;
import me.yeonjae.tonebridge.domain.user.CorrectorLevel;
import me.yeonjae.tonebridge.domain.user.OAuthProvider;
import me.yeonjae.tonebridge.domain.user.User;

import java.time.LocalDate;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Entity
@Table(name = "users")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Slf4j
public class UserEntity {

    // A plain ObjectMapper instance rather than the Spring-managed bean.
    // This is intentional: UserEntity is a JPA entity instantiated by Hibernate
    // outside the Spring application context, so @Autowired injection is not
    // available here.  The only types serialised are Map<String,String>, which
    // require no custom configuration, so a default instance is safe.
    // If richer Jackson configuration (e.g. custom modules, date handling) is ever
    // needed here, wire this via a static initialiser that reads from a shared
    // singleton rather than adding stateful Spring injection to the JPA layer.
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(nullable = false)
    private String nativeLanguage;

    @Column(name = "ui_language", nullable = false, length = 30)
    private String uiLanguage;

    @Column(name = "fluent_languages", length = 1024)
    private String fluentLanguagesRaw;

    @Column(name = "learning_languages", length = 1024)
    private String learningLanguagesRaw;

    @Column(name = "native_dialect", length = 30)
    private String nativeDialect;

    @Column(name = "fluent_lang_variants", length = 2048)
    private String fluentLangVariantsRaw;

    @Column(name = "learning_lang_variants", length = 2048)
    private String learningLangVariantsRaw;

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

    /** 인증 제공자. 기존 회원은 V21 마이그레이션에서 'GOOGLE'로 채워짐. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OAuthProvider provider;

    /** BCrypt 해시(60자). LOCAL 회원만 보유, GOOGLE 회원은 null. */
    @Column(name = "password_hash", length = 60)
    private String passwordHash;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (provider == null) provider = OAuthProvider.GOOGLE;
    }

    public User toDomain() {
        return new User(id, email, username, nativeLanguage, uiLanguage,
                parseList(fluentLanguagesRaw),
                parseList(learningLanguagesRaw),
                nativeDialect,
                parseMap(fluentLangVariantsRaw),
                parseMap(learningLangVariantsRaw),
                credits, reputationScore, correctorLevel,
                correctionStreak, lastCorrectionDate, createdAt, isAdmin,
                provider == null ? OAuthProvider.GOOGLE : provider, passwordHash);
    }

    public static UserEntity fromDomain(User user) {
        return UserEntity.builder()
                .id(user.id())
                .email(user.email())
                .username(user.username())
                .nativeLanguage(user.nativeLanguage())
                .uiLanguage(user.uiLanguage())
                .fluentLanguagesRaw(joinList(user.fluentLanguages()))
                .learningLanguagesRaw(joinList(user.learningLanguages()))
                .nativeDialect(user.nativeDialect())
                .fluentLangVariantsRaw(writeMap(user.fluentLanguageVariants()))
                .learningLangVariantsRaw(writeMap(user.learningLanguageVariants()))
                .credits(user.credits())
                .reputationScore(user.reputationScore())
                .correctorLevel(user.correctorLevel())
                .correctionStreak(user.correctionStreak())
                .lastCorrectionDate(user.lastCorrectionDate())
                .createdAt(user.createdAt())
                .isAdmin(user.isAdmin())
                .provider(user.provider())
                .passwordHash(user.passwordHash())
                .build();
    }

    public void updateFrom(User user) {
        this.username = user.username();
        this.nativeLanguage = user.nativeLanguage();
        this.uiLanguage = user.uiLanguage();
        this.fluentLanguagesRaw = joinList(user.fluentLanguages());
        this.learningLanguagesRaw = joinList(user.learningLanguages());
        this.nativeDialect = user.nativeDialect();
        this.fluentLangVariantsRaw = writeMap(user.fluentLanguageVariants());
        this.learningLangVariantsRaw = writeMap(user.learningLanguageVariants());
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

    private static Map<String, String> parseMap(String raw) {
        if (raw == null || raw.isBlank()) return new HashMap<>();
        try {
            return MAPPER.readValue(raw, new TypeReference<Map<String, String>>() {});
        } catch (JsonProcessingException e) {
            // Corrupted JSON in the column indicates a data-integrity problem.
            // Throw rather than silently return an empty map, which would cause
            // a user's saved dialect variants to disappear without any observable error.
            log.error("Failed to parse language variants JSON: {}", raw, e);
            throw new IllegalStateException("Corrupted language variant data in database", e);
        }
    }

    private static String writeMap(Map<String, String> map) {
        if (map == null || map.isEmpty()) return null;
        try {
            return MAPPER.writeValueAsString(map);
        } catch (JsonProcessingException e) {
            // Map<String, String> serialisation should never fail; throw so the
            // calling transaction is rolled back instead of silently dropping data.
            log.error("Failed to serialise language variants: {}", map, e);
            throw new IllegalStateException("Failed to serialise language variant data", e);
        }
    }
}
