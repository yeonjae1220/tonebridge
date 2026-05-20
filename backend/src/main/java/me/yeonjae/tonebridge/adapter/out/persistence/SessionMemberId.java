package me.yeonjae.tonebridge.adapter.out.persistence;

import java.io.Serializable;
import java.util.UUID;

public record SessionMemberId(UUID sessionId, UUID userId) implements Serializable {}
