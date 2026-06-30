package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/feedback")
public class FeedbackController {

    private static final Logger log = LoggerFactory.getLogger(FeedbackController.class);
    private static final Pattern EMAIL_RE = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    // 50 submissions per hour across all users (global, not per-IP)
    private static final int RATE_LIMIT = 50;
    private static final Duration RATE_WINDOW = Duration.ofHours(1);

    @Value("${lab.feedback.endpoint}")
    private String endpoint;

    @Value("${lab.feedback.token}")
    private String token;

    @Value("${lab.feedback.app-name}")
    private String appName;

    private final RestClient restClient;
    private final AtomicInteger requestCount = new AtomicInteger(0);
    private volatile Instant windowStart = Instant.now();

    public FeedbackController() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(5));
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    public record FeedbackRequest(
        String message,
        String email,
        String version,
        String website  // honeypot — must be empty; bots fill it
    ) {}

    @PostMapping
    public ResponseEntity<Map<String, Object>> submit(
            @RequestBody FeedbackRequest req,
            HttpServletRequest httpReq) {

        // 1. Honeypot check — silent 200 so bots cannot detect the filter
        if (StringUtils.hasText(req.website())) {
            return ResponseEntity.ok(Map.of("ok", true));
        }

        // 2. Global rate limit
        if (!tryAcquire()) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("ok", false, "error", "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."));
        }

        // 3. Validate message
        String message = req.message() != null ? req.message().trim() : "";
        if (message.isEmpty() || message.length() > 2000) {
            return ResponseEntity.badRequest()
                    .body(Map.of("ok", false, "error", "메시지를 입력해주세요 (최대 2000자)"));
        }

        // 4. Validate email (optional)
        String email = req.email() != null ? req.email().trim() : "";
        if (!email.isEmpty() && !EMAIL_RE.matcher(email).matches()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("ok", false, "error", "올바른 이메일 주소를 입력해주세요"));
        }

        // 5. Forward to lab-dashboard via in-cluster DNS (token never reaches the browser)
        try {
            restClient.post()
                    .uri(endpoint)
                    .header("X-Feedback-Token", token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "app", appName,
                            "message", message,
                            "email", email,
                            "version", req.version() != null ? req.version().trim() : "",
                            "userAgent", sanitize(httpReq.getHeader("User-Agent"))
                    ))
                    .retrieve()
                    .toBodilessEntity();
            return ResponseEntity.ok(Map.of("ok", true));
        } catch (Exception e) {
            log.error("[Feedback] forward failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("ok", false, "error", "전송에 실패했습니다. 잠시 후 다시 시도해주세요."));
        }
    }

    private synchronized boolean tryAcquire() {
        Instant now = Instant.now();
        if (now.isAfter(windowStart.plus(RATE_WINDOW))) {
            windowStart = now;
            requestCount.set(0);
        }
        return requestCount.incrementAndGet() <= RATE_LIMIT;
    }

    private String sanitize(String s) {
        if (s == null) return "";
        return s.length() > 512 ? s.substring(0, 512) : s;
    }
}
