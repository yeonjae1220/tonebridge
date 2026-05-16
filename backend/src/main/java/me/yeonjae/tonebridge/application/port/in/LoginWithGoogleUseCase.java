package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.adapter.in.web.dto.TokenResponse;

public interface LoginWithGoogleUseCase {
    TokenResponse login(String code, String redirectUri);
}
