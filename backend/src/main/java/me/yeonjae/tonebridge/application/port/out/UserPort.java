package me.yeonjae.tonebridge.application.port.out;

import me.yeonjae.tonebridge.domain.user.User;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserPort {
    Optional<User> findByEmail(String email);
    Optional<User> findByUsername(String username);
    Optional<User> findById(UUID id);
    List<User> findAllByIds(Collection<UUID> ids);
    User save(User user);
}
