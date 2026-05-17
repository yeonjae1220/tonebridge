package me.yeonjae.tonebridge.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.CorrectionPort;
import me.yeonjae.tonebridge.domain.correction.Correction;
import me.yeonjae.tonebridge.domain.correction.CorrectionStatus;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Transactional
public class CorrectionJpaAdapter implements CorrectionPort {

    private final CorrectionJpaRepository repository;

    @Override
    public Correction save(Correction correction) {
        return repository.save(CorrectionEntity.fromDomain(correction)).toDomain();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Correction> findById(UUID id) {
        return repository.findById(id).map(CorrectionEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Correction> findByReferenceAudioUrl(String referenceAudioUrl) {
        return repository.findByReferenceAudioUrl(referenceAudioUrl).map(CorrectionEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Correction> findByRequestId(UUID requestId) {
        return repository.findByRequestIdOrderByCreatedAtAsc(requestId)
                .stream()
                .map(CorrectionEntity::toDomain)
                .toList();
    }

    @Override
    public void updateStatus(UUID id, CorrectionStatus status) {
        repository.updateStatus(id, status);
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
        return repository.existsByRequestId(requestId);
    }
}
