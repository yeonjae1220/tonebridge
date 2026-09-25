package me.yeonjae.tonebridge.application.port.out;

import me.yeonjae.tonebridge.application.port.in.GetCorrectionFeedUseCase;
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
    /**
     * 정렬: preferredVariants 일치 우선 → created_at 최신 → id. {@code after} 가 있으면 그 지점 다음부터.
     * 다음 페이지 판별을 위해 호출자가 limit+1 을 넘기는 것을 전제로 한다.
     */
    List<CorrectionRequest> findFeedPage(UUID correctorId, List<String> baseLanguages, List<String> preferredVariants,
                                         GetCorrectionFeedUseCase.FeedCursor after, int limit);
    List<CorrectionRequest> findByRequesterId(UUID requesterId);
    void updateStatus(UUID id, RequestStatus status);
    CorrectionRequest updateContent(UUID id, String targetLanguage, String targetVariant, String contentText,
                                    String context, List<String> feedbackGoals);
    void softDelete(UUID id);
    List<CorrectionRequest> findPendingOlderThan(Instant threshold, int limit);
    void updateAcceptedCorrection(UUID requestId, UUID correctionId);
    Optional<CorrectionRequest> findByIdForUpdate(UUID id);
}
