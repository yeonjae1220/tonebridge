package me.yeonjae.tonebridge.application.port.out;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface UserBlockPort {
    record Entry(UUID userId, String username, Instant createdAt) {}
    boolean existsBetween(UUID first, UUID second);
    void lockUsers(UUID first, UUID second);
    void add(UUID owner, UUID target);
    void remove(UUID owner, UUID target);
    List<Entry> list(UUID owner, int offset, int limit);
}
