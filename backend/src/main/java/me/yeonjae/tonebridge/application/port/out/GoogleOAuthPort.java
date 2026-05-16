package me.yeonjae.tonebridge.application.port.out;

import me.yeonjae.tonebridge.adapter.out.ai.GoogleUserInfo;

public interface GoogleOAuthPort {
    String buildAuthorizationUrl(String redirectUri, String state);
    GoogleUserInfo exchangeCodeForUserInfo(String code, String redirectUri);
}
