package me.yeonjae.tonebridge.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.UserPort;
import me.yeonjae.tonebridge.domain.user.User;
import org.springframework.stereotype.Component;

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
    public Optional<User> findById(UUID id) {
        return userJpaRepository.findById(id).map(UserEntity::toDomain);
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
