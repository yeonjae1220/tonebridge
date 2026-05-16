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
            if (!response.isSuccessful() || response.body() == null) {
                throw new ToneBridgeException(ErrorCode.GOOGLE_AUTH_FAILED);
            }
            JsonNode json = objectMapper.readTree(response.body().string());
            return json.get("access_token").asText();
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

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
