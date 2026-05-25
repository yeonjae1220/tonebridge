package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.user.User;

import java.util.List;
import java.util.UUID;

public interface SearchUsersUseCase {
    record Command(UUID requesterId, String query, int limit) {}

    List<User> search(Command command);
}
