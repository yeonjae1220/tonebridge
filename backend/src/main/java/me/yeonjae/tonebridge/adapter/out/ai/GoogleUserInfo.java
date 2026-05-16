package me.yeonjae.tonebridge.adapter.out.ai;

public record GoogleUserInfo(
        String sub,       // Google user ID
        String email,
        String name,
        String picture
) {}
