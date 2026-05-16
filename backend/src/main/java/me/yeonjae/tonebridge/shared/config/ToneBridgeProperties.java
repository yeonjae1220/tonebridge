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

    @Getter @Setter
    public static class Storage {
        private String endpoint;
        private String accessKey;
        private String secretKey;
        private String bucket;
        private String region;
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
    }

    @Getter @Setter
    public static class Auth {
        private String frontendUrl = "http://localhost:3000";
        private String redirectUri = "http://localhost:8080/api/auth/google/callback";
    }
}
