package me.yeonjae.tonebridge.shared.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "tonebridge")
public class ToneBridgeProperties {
    private Storage storage = new Storage();
    private Ai ai = new Ai();
    private Credit credit = new Credit();
    private Correction correction = new Correction();
    private Auth auth = new Auth();
    private Admin admin = new Admin();
    private Fcm fcm = new Fcm();

    @Getter @Setter
    public static class Fcm {
        private String serviceAccountPath;
        private String projectId;
    }

    @Getter @Setter
    public static class Admin {
        private java.util.List<String> emails = new java.util.ArrayList<>();
    }

    @Getter @Setter
    public static class Storage {
        private String endpoint;
        /** Public-facing endpoint for presigned URLs (mobile/browser-accessible).
         *  Falls back to {@code endpoint} when not set. */
        private String publicEndpoint;
        private String accessKey;
        private String secretKey;
        private String bucket;
        private String region;
        /** Presigned upload URL TTL in minutes (default 15). */
        private int uploadTtlMinutes = 15;
        /** Presigned download URL TTL in minutes (default 15). */
        private int downloadTtlMinutes = 15;
        /** Max presigned URL requests per user per 60-second window (default 20). */
        private int rateLimitPerMinute = 20;
    }

    @Getter @Setter
    public static class Ai {
        private String claudeApiKey;
        private String claudeModel = "claude-sonnet-4-6";
        private String openaiApiKey;
    }

    @Getter @Setter
    public static class Credit {
        private int signupBonus = 30;
        private int textRequestCost = 5;
        private int audioRequestCost = 10;
        private int textCorrectionReward = 4;
        private int audioCorrectionReward = 8;
        private int audioWithRecordingReward = 12;
        private int streak7dayBonus = 10;
    }

    @Getter @Setter
    public static class Correction {
        private int expiryHours = 48;
        private int aiFallbackAfterHours = 48;
        private int fallbackBatchSize = 50;
        private long fallbackSchedulerIntervalMs = 3_600_000;
    }

    @Getter @Setter
    public static class Auth {
        private String frontendUrl = "http://localhost:3000";
        private String redirectUri = "http://localhost:8080/api/auth/google/callback";
        private String mobileRedirectUri = "tonebridge://oauth/callback";
    }

    private Gamification gamification = new Gamification();

    @Getter @Setter
    public static class Gamification {
        private boolean streakEnabled = true;
        private boolean reputationEnabled = true;
        private boolean badgesEnabled = true;
        private int badgeFastResponderCount = 5;
        private int badgeAudioExpertCount = 10;
        private int fastResponderMaxMinutes = 60;
    }
}
