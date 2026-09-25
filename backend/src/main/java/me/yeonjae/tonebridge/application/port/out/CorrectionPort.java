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
    /**
     * 현재 상태가 {@code expected} 일 때만 {@code next} 로 바꾼다.
     *
     * <p>비동기 품질 검사와 요청자의 채택이 같은 교정을 동시에 건드릴 수 있어 상태 전이는
     * 반드시 조건부여야 한다 — 무조건 덮어쓰면 이미 채택된(APPROVED) 교정이 뒤늦게 도착한
     * 품질 검사 결과로 REJECTED 가 된다.
     *
     * @return 실제로 바뀌었으면 true, 그 사이 다른 상태가 됐으면 false
     */
    boolean updateStatusIfCurrent(UUID id, CorrectionStatus expected, CorrectionStatus next);
    Correction updateContent(UUID id, String correctedText, String explanation, List<String> tags,
                             List<me.yeonjae.tonebridge.domain.correction.TimestampComment> timestampComments,
                             Integer pronunciationScore, Integer intonationScore, Integer fluencyScore,
                             String referenceAudioUrl);
    void softDelete(UUID id);
    long countApprovedAudioByCorrector(UUID correctorId);
    List<Object[]> findCorrectionTimingsByCorrector(UUID correctorId);
    boolean existsByRequestId(UUID requestId);

    // 좋아요
    /** 없으면 추가, 있으면 아무것도 안 한다 — 동시 요청에도 예외 없이 행 하나. */
    void addLike(UUID correctionId, UUID userId);
    /** 있으면 삭제, 없으면 아무것도 안 한다. */
    void removeLike(UUID correctionId, UUID userId);
    Map<UUID, Long> findLikeCountsByCorrectionIds(List<UUID> correctionIds);
    Set<UUID> findLikedCorrectionIds(List<UUID> correctionIds, UUID userId);
}
