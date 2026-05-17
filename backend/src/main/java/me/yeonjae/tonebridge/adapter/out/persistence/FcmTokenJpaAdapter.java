package me.yeonjae.tonebridge.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.FcmTokenPort;
import me.yeonjae.tonebridge.domain.user.FcmToken;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Transactional
public class FcmTokenJpaAdapter implements FcmTokenPort {

    private final FcmTokenJpaRepository repository;

    @Override
    public void saveOrUpdate(FcmToken token) {
        repository.findByUserId(token.userId())
                .ifPresentOrElse(
                        existing -> existing.updateToken(token.token(), token.platform()),
                        () -> repository.save(FcmTokenEntity.fromDomain(token))
                );
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<FcmToken> findByUserId(UUID userId) {
        return repository.findByUserId(userId).map(FcmTokenEntity::toDomain);
    }

    @Override
    public void deleteByToken(String token) {
        repository.deleteByToken(token);
    }
}
