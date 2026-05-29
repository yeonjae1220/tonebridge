package me.yeonjae.tonebridge.application.port.out;

import me.yeonjae.tonebridge.domain.correction.Correction;
import me.yeonjae.tonebridge.domain.correction.CorrectionStatus;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

public interface CorrectionPort {
    Correction save(Correction correction);
    Optional<Correction> findById(UUID id);
    Optional<Correction> findByReferenceAudioUrl(String referenceAudioUrl);
    List<Correction> findByRequestId(UUID requestId);
    void updateStatus(UUID id, CorrectionStatus status);
    Correction updateContent(UUID id, String correctedText, String explanation, List<String> tags,
                             List<me.yeonjae.tonebridge.domain.correction.TimestampComment> timestampComments,
                             Integer pronunciationScore, Integer intonationScore, Integer fluencyScore,
                             String referenceAudioUrl);
    void softDelete(UUID id);
    long countApprovedAudioByCorrector(UUID correctorId);
    List<Object[]> findCorrectionTimingsByCorrector(UUID correctorId);
    boolean existsByRequestId(UUID requestId);

    // 좋아요
    boolean toggleLike(UUID correctionId, UUID userId);
    Map<UUID, Long> findLikeCountsByCorrectionIds(List<UUID> correctionIds);
    Set<UUID> findLikedCorrectionIds(List<UUID> correctionIds, UUID userId);
}
