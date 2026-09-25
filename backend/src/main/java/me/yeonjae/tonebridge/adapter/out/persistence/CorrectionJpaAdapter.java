package me.yeonjae.tonebridge.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.CorrectionPort;
import me.yeonjae.tonebridge.domain.correction.Correction;
import me.yeonjae.tonebridge.domain.correction.CorrectionStatus;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Transactional
public class CorrectionJpaAdapter implements CorrectionPort {

    private final CorrectionJpaRepository repository;
    private final CorrectionLikeJpaRepository likeRepository;

    @Override
    public Correction save(Correction correction) {
        return repository.save(CorrectionEntity.fromDomain(correction)).toDomain();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Correction> findById(UUID id) {
        return repository.findActiveById(id).map(CorrectionEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Correction> findByReferenceAudioUrl(String referenceAudioUrl) {
        return repository.findByReferenceAudioUrlAndDeletedAtIsNull(referenceAudioUrl).map(CorrectionEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Correction> findByRequestId(UUID requestId) {
        return repository.findByRequestIdAndDeletedAtIsNullOrderByCreatedAtAsc(requestId)
                .stream()
                .map(CorrectionEntity::toDomain)
                .toList();
    }

    @Override
    public boolean updateStatusIfCurrent(UUID id, CorrectionStatus expected, CorrectionStatus next) {
        return repository.updateStatusIfCurrent(id, expected, next) > 0;
    }

    @Override
    public Correction updateContent(UUID id, String correctedText, String explanation, List<String> tags,
                                    List<me.yeonjae.tonebridge.domain.correction.TimestampComment> timestampComments,
                                    Integer pronunciationScore, Integer intonationScore, Integer fluencyScore,
                                    String referenceAudioUrl) {
        CorrectionEntity entity = repository.findActiveById(id)
                .orElseThrow(() -> new IllegalStateException("Correction not found for update: id=" + id));
        entity.updateContent(correctedText, explanation, tags, timestampComments,
                pronunciationScore, intonationScore, fluencyScore, referenceAudioUrl);
        return repository.save(entity).toDomain();
    }

    @Override
    public void softDelete(UUID id) {
        CorrectionEntity entity = repository.findActiveById(id)
                .orElseThrow(() -> new IllegalStateException("Correction not found for delete: id=" + id));
        entity.softDelete();
        repository.save(entity);
    }

    private static final int FAST_RESPONDER_TIMING_LIMIT = 100;

    @Override
    @Transactional(readOnly = true)
    public long countApprovedAudioByCorrector(UUID correctorId) {
        return repository.countApprovedAudioByCorrector(correctorId, CorrectionStatus.APPROVED, "AUDIO");
    }

    @Override
    @Transactional(readOnly = true)
    public List<Object[]> findCorrectionTimingsByCorrector(UUID correctorId) {
        return repository.findCorrectionTimingsByCorrector(
                correctorId,
                CorrectionStatus.APPROVED,
                PageRequest.of(0, FAST_RESPONDER_TIMING_LIMIT, Sort.by(Sort.Direction.DESC, "createdAt")));
    }

    @Override
    @Transactional(readOnly = true)
    public boolean existsByRequestId(UUID requestId) {
        return repository.existsByRequestIdAndDeletedAtIsNull(requestId);
    }

    @Override
    public void addLike(UUID correctionId, UUID userId) {
        likeRepository.insertIfAbsent(UUID.randomUUID(), correctionId, userId);
    }

    @Override
    public void removeLike(UUID correctionId, UUID userId) {
        likeRepository.deleteLike(correctionId, userId);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, Long> findLikeCountsByCorrectionIds(List<UUID> correctionIds) {
        if (correctionIds.isEmpty()) return Map.of();
        Map<UUID, Long> result = new HashMap<>();
        likeRepository.countLikesByCorrectionIds(correctionIds)
                .forEach(row -> result.put((UUID) row[0], (Long) row[1]));
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public Set<UUID> findLikedCorrectionIds(List<UUID> correctionIds, UUID userId) {
        if (correctionIds.isEmpty()) return Set.of();
        return likeRepository.findLikedCorrectionIds(correctionIds, userId);
    }
}
