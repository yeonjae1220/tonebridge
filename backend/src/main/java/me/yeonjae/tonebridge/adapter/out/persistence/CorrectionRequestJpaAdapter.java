package me.yeonjae.tonebridge.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.CorrectionRequestPort;
import me.yeonjae.tonebridge.domain.correction.CorrectionRequest;
import me.yeonjae.tonebridge.domain.correction.RequestStatus;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Transactional
public class CorrectionRequestJpaAdapter implements CorrectionRequestPort {

    private final CorrectionRequestJpaRepository repository;

    @Override
    public CorrectionRequest save(CorrectionRequest request) {
        return repository.save(CorrectionRequestEntity.fromDomain(request)).toDomain();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<CorrectionRequest> findById(UUID id) {
        return repository.findActiveById(id).map(CorrectionRequestEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<CorrectionRequest> findByAudioUrl(String audioUrl) {
        return repository.findByAudioUrlAndDeletedAtIsNull(audioUrl).map(CorrectionRequestEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CorrectionRequest> findFeed(UUID correctorId, List<String> fluentLanguages, int limit) {
        return repository.findFeed(correctorId, fluentLanguages, PageRequest.of(0, limit))
                .stream()
                .map(CorrectionRequestEntity::toDomain)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<CorrectionRequest> findByRequesterId(UUID requesterId) {
        return repository.findByRequesterIdAndDeletedAtIsNullOrderByCreatedAtDesc(requesterId)
                .stream()
                .map(CorrectionRequestEntity::toDomain)
                .toList();
    }

    @Override
    public void updateStatus(UUID id, RequestStatus status) {
        repository.updateStatus(id, status);
    }

    @Override
    public CorrectionRequest updateContent(UUID id, String targetLanguage, String targetVariant, String contentText,
                                           String context, List<String> feedbackGoals) {
        CorrectionRequestEntity entity = repository.findActiveById(id)
                .orElseThrow(() -> new IllegalStateException("Correction request not found for update: id=" + id));
        entity.updateContent(targetLanguage, targetVariant, contentText, context, feedbackGoals);
        return repository.save(entity).toDomain();
    }

    @Override
    public void softDelete(UUID id) {
        CorrectionRequestEntity entity = repository.findActiveById(id)
                .orElseThrow(() -> new IllegalStateException("Correction request not found for delete: id=" + id));
        entity.softDelete();
        repository.save(entity);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CorrectionRequest> findPendingOlderThan(Instant threshold, int limit) {
        return repository.findPendingOlderThan(threshold, PageRequest.of(0, limit))
                .stream()
                .map(CorrectionRequestEntity::toDomain)
                .toList();
    }

    @Override
    public void updateAcceptedCorrection(UUID requestId, UUID correctionId) {
        repository.updateAcceptedCorrection(requestId, correctionId);
    }

    @Override
    public Optional<CorrectionRequest> findByIdForUpdate(UUID id) {
        return repository.findActiveByIdForUpdate(id).map(CorrectionRequestEntity::toDomain);
    }
}
