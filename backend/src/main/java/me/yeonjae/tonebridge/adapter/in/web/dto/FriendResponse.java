package me.yeonjae.tonebridge.adapter.in.web.dto;

import me.yeonjae.tonebridge.domain.user.User;

import java.util.UUID;

public record FriendResponse(
        UUID id,
        String username,
        String nativeLanguage
) {
    public static FriendResponse from(User user) {
        return new FriendResponse(user.id(), user.username(), user.nativeLanguage());
    }
}
