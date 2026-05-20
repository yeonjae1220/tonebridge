package me.yeonjae.tonebridge.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.StudyCardPort;
import me.yeonjae.tonebridge.domain.studycard.StudyCard;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Transactional
public class StudyCardJpaAdapter implements StudyCardPort {

    private final StudyCardJpaRepository repository;

    @Override
    public StudyCard save(StudyCard card) {
        return repository.save(StudyCardEntity.fromDomain(card)).toDomain();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<StudyCard> findById(UUID id) {
        return repository.findById(id).map(StudyCardEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<StudyCard> findBySessionId(UUID sessionId) {
        return repository.findBySessionIdOrderByCreatedAtDesc(sessionId)
                .stream().map(StudyCardEntity::toDomain).toList();
    }
}
