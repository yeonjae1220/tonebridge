package me.yeonjae.tonebridge.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.LearnerAttemptPort;
import me.yeonjae.tonebridge.domain.studycard.LearnerAttempt;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Transactional
public class LearnerAttemptJpaAdapter implements LearnerAttemptPort {

    private final LearnerAttemptJpaRepository repository;

    @Override
    public LearnerAttempt save(LearnerAttempt attempt) {
        return repository.save(LearnerAttemptEntity.fromDomain(attempt)).toDomain();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<LearnerAttempt> findById(UUID id) {
        return repository.findById(id).map(LearnerAttemptEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<LearnerAttempt> findLatestByCardId(UUID cardId) {
        return repository.findFirstByCardIdOrderByAttemptedAtDesc(cardId).map(LearnerAttemptEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<LearnerAttempt> findByCardId(UUID cardId) {
        return repository.findByCardIdOrderByAttemptedAtDesc(cardId)
                .stream().map(LearnerAttemptEntity::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<LearnerAttempt> findByLearnerId(UUID learnerId) {
        return repository.findByLearnerIdOrderByAttemptedAtDesc(learnerId)
                .stream().map(LearnerAttemptEntity::toDomain).toList();
    }
}
