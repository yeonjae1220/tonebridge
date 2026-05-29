package me.yeonjae.tonebridge.application.port.out;

import me.yeonjae.tonebridge.domain.correction.CorrectionRequest;
import me.yeonjae.tonebridge.domain.correction.RequestStatus;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CorrectionRequestPort {
    CorrectionRequest save(CorrectionRequest request);
    Optional<CorrectionRequest> findById(UUID id);
    Optional<CorrectionRequest> findByAudioUrl(String audioUrl);
    List<CorrectionRequest> findFeed(UUID correctorId, List<String> baseLanguages, int limit);
    List<CorrectionRequest> findByRequesterId(UUID requesterId);
    void updateStatus(UUID id, RequestStatus status);
    CorrectionRequest updateContent(UUID id, String targetLanguage, String targetVariant, String contentText,
                                    String context, List<String> feedbackGoals);
    void softDelete(UUID id);
    List<CorrectionRequest> findPendingOlderThan(Instant threshold, int limit);
    void updateAcceptedCorrection(UUID requestId, UUID correctionId);
    Optional<CorrectionRequest> findByIdForUpdate(UUID id);
}
