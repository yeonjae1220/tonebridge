package me.yeonjae.tonebridge.adapter.in.web.dto;

import me.yeonjae.tonebridge.domain.user.User;

import java.util.UUID;

public record UserSearchResponse(UUID id, String username, String nativeLanguage) {
    public static UserSearchResponse from(User user) {
        return new UserSearchResponse(user.id(), user.username(), user.nativeLanguage());
    }
}
