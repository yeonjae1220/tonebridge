package me.yeonjae.tonebridge.application.port.out;

import me.yeonjae.tonebridge.domain.user.User;

import java.util.Optional;
import java.util.UUID;

public interface UserPort {
    Optional<User> findByEmail(String email);
    Optional<User> findById(UUID id);
    User save(User user);
}
