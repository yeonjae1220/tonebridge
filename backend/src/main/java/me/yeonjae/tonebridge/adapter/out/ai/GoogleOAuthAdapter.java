package me.yeonjae.tonebridge.adapter.out.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import me.yeonjae.tonebridge.application.port.out.GoogleOAuthPort;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
public class GoogleOAuthAdapter implements GoogleOAuthPort {

    @Value("${google.oauth2.client-id}")
    private String clientId;

    // iOS google_sign_in SDK sets aud = iOS client ID (not serverClientId)
    @Value("${google.oauth2.ios-client-id:}")
    private String iosClientId;

    @Value("${google.oauth2.client-secret}")
    private String clientSecret;

    @Value("${google.oauth2.token-uri}")
    private String tokenUri;

    @Value("${google.oauth2.userinfo-uri}")
    private String userinfoUri;

    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .build();

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public String buildAuthorizationUrl(String redirectUri, String state) {
        return "https://accounts.google.com/o/oauth2/v2/auth" +
               "?client_id=" + encode(clientId) +
               "&redirect_uri=" + encode(redirectUri) +
               "&response_type=code" +
               "&scope=openid%20email%20profile" +
               "&access_type=offline" +
               "&state=" + encode(state);
    }

    @Override
    public GoogleUserInfo exchangeCodeForUserInfo(String code, String redirectUri) {
        String accessToken = exchangeCodeForAccessToken(code, redirectUri);
        return fetchUserInfo(accessToken);
    }

    private String exchangeCodeForAccessToken(String code, String redirectUri) {
        RequestBody body = new FormBody.Builder()
                .add("code", code)
                .add("client_id", clientId)
                .add("client_secret", clientSecret)
                .add("redirect_uri", redirectUri)
                .add("grant_type", "authorization_code")
                .build();

        Request request = new Request.Builder().url(tokenUri).post(body).build();
        try (Response response = httpClient.newCall(request).execute()) {
            String responseBody = response.body() != null ? response.body().string() : "(no body)";
            if (!response.isSuccessful()) {
                log.error("Google token exchange failed: HTTP {} - {}", response.code(), responseBody);
                throw new ToneBridgeException(ErrorCode.GOOGLE_AUTH_FAILED);
            }
            JsonNode json = objectMapper.readTree(responseBody);
            JsonNode accessTokenNode = json.get("access_token");
            if (accessTokenNode == null || accessTokenNode.isNull()) {
                log.error("Google token response missing access_token: {}", json);
                throw new ToneBridgeException(ErrorCode.GOOGLE_AUTH_FAILED);
            }
            return accessTokenNode.asText();
        } catch (IOException e) {
            log.error("Google token exchange failed", e);
            throw new ToneBridgeException(ErrorCode.GOOGLE_AUTH_FAILED);
        }
    }

    private GoogleUserInfo fetchUserInfo(String accessToken) {
        Request request = new Request.Builder()
                .url(userinfoUri)
                .header("Authorization", "Bearer " + accessToken)
                .get()
                .build();
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                throw new ToneBridgeException(ErrorCode.GOOGLE_AUTH_FAILED);
            }
            JsonNode json = objectMapper.readTree(response.body().string());
            return new GoogleUserInfo(
                    json.get("sub").asText(),
                    json.get("email").asText(),
                    json.path("name").asText(""),
                    json.path("picture").asText("")
            );
        } catch (IOException e) {
            log.error("Google userinfo fetch failed", e);
            throw new ToneBridgeException(ErrorCode.GOOGLE_AUTH_FAILED);
        }
    }

    @Override
    public GoogleUserInfo verifyIdToken(String idToken) {
        HttpUrl url = HttpUrl.parse("https://oauth2.googleapis.com/tokeninfo")
                .newBuilder()
                .addQueryParameter("id_token", idToken)
                .build();

        Request request = new Request.Builder().url(url).get().build();
        try (Response response = httpClient.newCall(request).execute()) {
            String responseBody = response.body() != null ? response.body().string() : "(no body)";
            if (!response.isSuccessful()) {
                log.error("Google tokeninfo verification failed: HTTP {} - {}", response.code(), responseBody);
                throw new ToneBridgeException(ErrorCode.GOOGLE_AUTH_FAILED);
            }
            JsonNode json = objectMapper.readTree(responseBody);

            // Verify the token was issued for this app — prevents token substitution attacks.
            // iOS google_sign_in SDK sets aud = iOS client ID; Android sets aud = web client ID.
            String aud = json.path("aud").asText("");
            boolean audValid = clientId.equals(aud) || (!iosClientId.isEmpty() && iosClientId.equals(aud));
            if (!audValid) {
                log.warn("idToken aud mismatch: expected={} or={} got={}", clientId, iosClientId, aud);
                throw new ToneBridgeException(ErrorCode.GOOGLE_AUTH_FAILED);
            }

            // Reject tokens where Google has not yet verified the email address
            if (!"true".equals(json.path("email_verified").asText("false"))) {
                log.warn("idToken email not verified for sub={}", json.path("sub").asText());
                throw new ToneBridgeException(ErrorCode.GOOGLE_AUTH_FAILED);
            }

            return new GoogleUserInfo(
                    json.path("sub").asText(),
                    json.path("email").asText(),
                    json.path("name").asText(""),
                    json.path("picture").asText("")
            );
        } catch (IOException e) {
            log.error("Google idToken verification failed", e);
            throw new ToneBridgeException(ErrorCode.GOOGLE_AUTH_FAILED);
        }
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
