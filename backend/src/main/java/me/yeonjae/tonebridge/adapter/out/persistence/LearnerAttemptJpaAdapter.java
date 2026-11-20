package me.yeonjae.tonebridge.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.LearnerAttemptPort;
import me.yeonjae.tonebridge.domain.studycard.LearnerAttempt;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Transactional
public class LearnerAttemptJpaAdapter implements LearnerAttemptPort {

    private final LearnerAttemptJpaRepository repository;
    private final AttemptSoundTargetJpaRepository soundTargets;

    @Override
    public Optional<LearnerAttempt> findByRecording(UUID cardId, UUID learnerId, String audioKey) {
        return repository.findFirstByCardIdAndLearnerIdAndAudioUrlOrderByAttemptedAtAsc(cardId, learnerId, audioKey)
                .map(LearnerAttemptEntity::toDomain).map(this::withSoundTargets);
    }

    @Override
    public LearnerAttempt save(LearnerAttempt attempt) {
        // Sound targets are written only through replaceSoundTargets, so saving the attempt row keeps them.
        return repository.save(LearnerAttemptEntity.fromDomain(attempt)).toDomain().withSoundGuideIds(attempt.soundGuideIds());
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<LearnerAttempt> findById(UUID id) {
        return repository.findById(id).map(LearnerAttemptEntity::toDomain).map(this::withSoundTargets);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<LearnerAttempt> findLatestByCardId(UUID cardId) {
        return repository.findFirstByCardIdOrderByAttemptedAtDesc(cardId).map(LearnerAttemptEntity::toDomain).map(this::withSoundTargets);
    }

    @Override
    @Transactional(readOnly = true)
    public List<LearnerAttempt> findByCardId(UUID cardId) {
        return withSoundTargets(repository.findByCardIdOrderByAttemptedAtDesc(cardId)
                .stream().map(LearnerAttemptEntity::toDomain).toList());
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, LearnerAttempt> findLatestByCardIds(Set<UUID> cardIds) {
        if (cardIds.isEmpty()) {
            return Map.of();
        }
        return withSoundTargets(repository.findLatestByCardIdIn(cardIds).stream()
                .map(LearnerAttemptEntity::toDomain).toList()).stream()
                .collect(Collectors.toMap(LearnerAttempt::cardId, attempt -> attempt));
    }

    @Override
    @Transactional(readOnly = true)
    public List<LearnerAttempt> findByLearnerId(UUID learnerId) {
        return withSoundTargets(repository.findByLearnerIdOrderByAttemptedAtDesc(learnerId)
                .stream().map(LearnerAttemptEntity::toDomain).toList());
    }

    @Override
    public void replaceSoundTargets(UUID attemptId, List<String> guideIds, UUID authorId) {
        repository.lockById(attemptId);
        soundTargets.deleteByAttemptId(attemptId);
        Instant now = Instant.now();
        List<AttemptSoundTargetEntity> rows = new ArrayList<>();
        for (int position = 0; position < guideIds.size(); position++) {
            rows.add(new AttemptSoundTargetEntity(attemptId, guideIds.get(position), position, authorId, now));
        }
        soundTargets.saveAll(rows);
    }

    private LearnerAttempt withSoundTargets(LearnerAttempt attempt) {
        return withSoundTargets(List.of(attempt)).getFirst();
    }

    /** Loads the sound targets for every attempt in one query (no N+1). */
    private List<LearnerAttempt> withSoundTargets(List<LearnerAttempt> attempts) {
        if (attempts.isEmpty()) return attempts;
        Map<UUID, List<String>> byAttempt = new LinkedHashMap<>();
        soundTargets.findByAttemptIdInOrderByAttemptIdAscPositionAsc(attempts.stream().map(LearnerAttempt::id).toList())
                .forEach(t -> byAttempt.computeIfAbsent(t.getAttemptId(), id -> new ArrayList<>()).add(t.getGuideId()));
        return attempts.stream().map(a -> a.withSoundGuideIds(byAttempt.getOrDefault(a.id(), List.of()))).toList();
    }
}
