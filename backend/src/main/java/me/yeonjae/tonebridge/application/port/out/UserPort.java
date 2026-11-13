package me.yeonjae.tonebridge.application.port.out;

import me.yeonjae.tonebridge.domain.user.User;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserPort {
    Optional<User> findByEmail(String email);
    Optional<User> findByUsername(String username);
    boolean existsByEmail(String email);
    boolean existsByUsername(String username);
    Optional<User> findById(UUID id);
    List<User> findAllByIds(Collection<UUID> ids);
    List<User> searchByUsernamePrefix(String prefix, int limit);
    Optional<User> findByEmailForUpdate(String email);
    Optional<User> findByIdForUpdate(UUID id);
    long credentialsVersion(UUID id);
    void resetPassword(UUID id, String passwordHash);
    User save(User user);
    void deleteById(UUID id);
}
