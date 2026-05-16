package me.yeonjae.tonebridge.adapter.out.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.yeonjae.tonebridge.application.port.out.AiQualityCheckPort;
import me.yeonjae.tonebridge.application.service.QualityCheckCompletedEvent;
import me.yeonjae.tonebridge.shared.config.ToneBridgeProperties;
import okhttp3.*;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
@RequiredArgsConstructor
public class ClaudeAiAdapter implements AiQualityCheckPort {

    private final ToneBridgeProperties properties;
    private final ApplicationEventPublisher eventPublisher;

    private static final MediaType JSON_MEDIA = MediaType.get("application/json");
    private static final int MIN_EXPLANATION_LENGTH = 20;

    @Async
    @Override
    public void checkQualityAsync(UUID correctionId, UUID correctorId, UUID requesterId,
                                   String original, String corrected, String explanation, int reward) {
        boolean passed;
        try {
            passed = checkWithClaude(original, corrected, explanation);
        } catch (Exception e) {
            log.warn("Claude quality check failed for {}, using heuristic: {}", correctionId, e.getMessage());
            passed = meetsMinimumCriteria(explanation);
        }

        eventPublisher.publishEvent(
                new QualityCheckCompletedEvent(correctionId, correctorId, requesterId, passed, reward));
    }

    private boolean checkWithClaude(String original, String corrected, String explanation) throws Exception {
        String apiKey = properties.getAi().getClaudeApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            return meetsMinimumCriteria(explanation);
        }

        OkHttpClient client = new OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .build();

        String esc = original.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
        String escC = corrected.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
        String escE = explanation.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");

        String prompt = "Evaluate this language correction quality.\\n"
                + "Original: " + esc + "\\n"
                + "Corrected: " + escC + "\\n"
                + "Explanation: " + escE + "\\n"
                + "Reply ONLY with PASS if the explanation is clear and educational (>=20 chars), otherwise FAIL.";

        String body = "{\"model\":\"" + properties.getAi().getClaudeModel() + "\","
                + "\"max_tokens\":5,"
                + "\"messages\":[{\"role\":\"user\",\"content\":\"" + prompt + "\"}]}";

        Request request = new Request.Builder()
                .url("https://api.anthropic.com/v1/messages")
                .header("x-api-key", apiKey)
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .post(RequestBody.create(body, JSON_MEDIA))
                .build();

        try (Response response = client.newCall(request).execute()) {
            if (!response.isSuccessful()) return meetsMinimumCriteria(explanation);
            String responseBody = response.body() != null ? response.body().string() : "";
            return responseBody.contains("PASS");
        }
    }

    private boolean meetsMinimumCriteria(String explanation) {
        return explanation != null && explanation.trim().length() >= MIN_EXPLANATION_LENGTH;
    }
}
