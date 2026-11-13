package me.yeonjae.tonebridge.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.UserPort;
import me.yeonjae.tonebridge.domain.user.User;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class UserJpaAdapter implements UserPort {

    private final UserJpaRepository userJpaRepository;

    @Override
    public Optional<User> findByEmail(String email) {
        return userJpaRepository.findByEmail(email).map(UserEntity::toDomain);
    }

    @Override
    public Optional<User> findByUsername(String username) {
        return userJpaRepository.findByUsername(username).map(UserEntity::toDomain);
    }

    @Override
    public boolean existsByEmail(String email) {
        return userJpaRepository.existsByEmail(email);
    }

    @Override
    public boolean existsByUsername(String username) {
        return userJpaRepository.existsByUsername(username);
    }

    @Override
    public Optional<User> findById(UUID id) {
        return userJpaRepository.findById(id).map(UserEntity::toDomain);
    }

    @Override
    public List<User> findAllByIds(Collection<UUID> ids) {
        return userJpaRepository.findAllById(ids).stream().map(UserEntity::toDomain).toList();
    }

    @Override
    public List<User> searchByUsernamePrefix(String prefix, int limit) {
        return userJpaRepository
                .findByUsernameStartingWithIgnoreCase(prefix, PageRequest.of(0, limit))
                .stream()
                .map(UserEntity::toDomain)
                .toList();
    }

    @Override
    public void deleteById(UUID id) {
        userJpaRepository.deleteById(id);
    }

    @Override
    public Optional<User> findByEmailForUpdate(String email) {
        return userJpaRepository.findByEmailForUpdate(email).map(UserEntity::toDomain);
    }

    @Override
    public Optional<User> findByIdForUpdate(UUID id) {
        return userJpaRepository.findByIdForUpdate(id).map(UserEntity::toDomain);
    }

    @Override
    public long credentialsVersion(UUID id) {
        return userJpaRepository.credentialsVersion(id).orElseThrow(() ->
                new me.yeonjae.tonebridge.shared.exception.ToneBridgeException(
                        me.yeonjae.tonebridge.shared.exception.ErrorCode.INVALID_TOKEN));
    }

    @Override
    public void resetPassword(UUID id, String hash) {
        UserEntity user = userJpaRepository.findByIdForUpdate(id).orElseThrow();
        user.setPasswordHash(hash);
        user.setCredentialsVersion(Math.addExact(user.getCredentialsVersion(), 1));
        userJpaRepository.saveAndFlush(user);
    }

    @Override
    public User save(User user) {
        if (user.id() != null) {
            Optional<UserEntity> existing = userJpaRepository.findById(user.id());
            if (existing.isPresent()) {
                UserEntity entity = existing.get();
                entity.updateFrom(user);
                return userJpaRepository.save(entity).toDomain();
            }
        }
        return userJpaRepository.save(UserEntity.fromDomain(user)).toDomain();
    }
}
