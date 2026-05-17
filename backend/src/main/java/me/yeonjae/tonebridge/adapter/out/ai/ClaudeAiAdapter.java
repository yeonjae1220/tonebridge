package me.yeonjae.tonebridge.adapter.out.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import me.yeonjae.tonebridge.application.port.out.AiFallbackPort;
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
public class ClaudeAiAdapter implements AiQualityCheckPort, AiFallbackPort {

    private final ToneBridgeProperties properties;
    private final ApplicationEventPublisher eventPublisher;
    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;

    private static final MediaType JSON_MEDIA = MediaType.get("application/json");
    private static final int MIN_EXPLANATION_LENGTH = 20;

    public ClaudeAiAdapter(ToneBridgeProperties properties, ApplicationEventPublisher eventPublisher,
                            ObjectMapper objectMapper) {
        this.properties = properties;
        this.eventPublisher = eventPublisher;
        this.objectMapper = objectMapper;
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .build();
    }

    @Async
    @Override
    public void checkQualityAsync(UUID correctionId, UUID correctorId, UUID requesterId,
                                   String original, String corrected, String explanation, int reward, boolean isAudio) {
        boolean passed;
        try {
            passed = checkWithClaude(original, corrected, explanation);
        } catch (Exception e) {
            log.warn("Claude quality check failed for {}, using heuristic: {}", correctionId, e.getMessage());
            passed = meetsMinimumCriteria(explanation);
        }

        eventPublisher.publishEvent(
                new QualityCheckCompletedEvent(correctionId, correctorId, requesterId, passed, reward, isAudio));
    }

    @Override
    public FallbackResult generateFallback(String originalText, String targetLanguage, String context) {
        String apiKey = properties.getAi().getClaudeApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            return buildHeuristicFallback(originalText);
        }
        try {
            return callClaudeForFallback(apiKey, originalText, targetLanguage, context);
        } catch (Exception e) {
            log.warn("Claude fallback generation failed, using heuristic: {}", e.getMessage());
            return buildHeuristicFallback(originalText);
        }
    }

    private FallbackResult callClaudeForFallback(String apiKey, String originalText,
                                                  String targetLanguage, String context) throws Exception {
        String ctx = context != null ? context : "";
        String prompt = "You are a native " + targetLanguage + " language expert. "
                + "Correct the following text naturally and explain the corrections.\n"
                + "Context: " + ctx + "\n"
                + "Text: " + originalText + "\n"
                + "Reply in this exact format:\n"
                + "CORRECTED: <corrected text>\n"
                + "EXPLANATION: <brief explanation in Korean>";

        String body = buildRequestBody(properties.getAi().getClaudeModel(), 500, prompt);

        Request request = new Request.Builder()
                .url("https://api.anthropic.com/v1/messages")
                .header("x-api-key", apiKey)
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .post(RequestBody.create(body, JSON_MEDIA))
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                return buildHeuristicFallback(originalText);
            }
            return parseFallbackResponse(response.body().string(), originalText);
        }
    }

    private FallbackResult parseFallbackResponse(String responseBody, String originalText) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode contentNode = root.path("content");
            if (contentNode.isEmpty()) return buildHeuristicFallback(originalText);

            String content = contentNode.get(0).path("text").asText("");
            String corrected = originalText;
            String explanation = "AI가 첨삭하였습니다.";

            for (String line : content.split("\n")) {
                if (line.startsWith("CORRECTED:")) {
                    corrected = line.substring("CORRECTED:".length()).trim();
                } else if (line.startsWith("EXPLANATION:")) {
                    explanation = line.substring("EXPLANATION:".length()).trim();
                }
            }
            return new FallbackResult(corrected, "[AI 첨삭] " + explanation);
        } catch (Exception e) {
            log.warn("Failed to parse Claude fallback response: {}", e.getMessage());
            return buildHeuristicFallback(originalText);
        }
    }

    private FallbackResult buildHeuristicFallback(String originalText) {
        return new FallbackResult(originalText, "[AI 첨삭] 48시간 내 원어민 첨삭이 없어 AI가 검토하였습니다.");
    }

    private boolean checkWithClaude(String original, String corrected, String explanation) throws Exception {
        String apiKey = properties.getAi().getClaudeApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            return meetsMinimumCriteria(explanation);
        }

        String prompt = "Evaluate this language correction quality.\n"
                + "Original: " + original + "\n"
                + "Corrected: " + corrected + "\n"
                + "Explanation: " + explanation + "\n"
                + "Reply ONLY with PASS if the explanation is clear and educational (>=20 chars), otherwise FAIL.";

        String body = buildRequestBody(properties.getAi().getClaudeModel(), 5, prompt);

        Request request = new Request.Builder()
                .url("https://api.anthropic.com/v1/messages")
                .header("x-api-key", apiKey)
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .post(RequestBody.create(body, JSON_MEDIA))
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) return meetsMinimumCriteria(explanation);
            String responseBody = response.body() != null ? response.body().string() : "";
            JsonNode root = objectMapper.readTree(responseBody);
            String text = root.path("content").get(0).path("text").asText("");
            return text.contains("PASS");
        }
    }

    private String buildRequestBody(String model, int maxTokens, String prompt) throws Exception {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", model);
        body.put("max_tokens", maxTokens);
        ArrayNode messages = body.putArray("messages");
        messages.addObject().put("role", "user").put("content", prompt);
        return objectMapper.writeValueAsString(body);
    }

    private boolean meetsMinimumCriteria(String explanation) {
        return explanation != null && explanation.trim().length() >= MIN_EXPLANATION_LENGTH;
    }
}
