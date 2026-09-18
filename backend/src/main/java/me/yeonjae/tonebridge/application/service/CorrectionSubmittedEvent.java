package me.yeonjae.tonebridge.application.service;

import java.util.UUID;

/**
 * 교정이 저장된 뒤 AI 품질 검사를 시작하기 위한 이벤트.
 *
 * <p>검사는 저장 트랜잭션이 커밋된 뒤에 시작해야 한다 — 커밋 전에 검사 결과가 나오면
 * 아직 다른 트랜잭션에 보이지 않는 행을 갱신하게 되어 결과가 조용히 사라진다.
 */
public record CorrectionSubmittedEvent(
        UUID correctionId,
        UUID correctorId,
        UUID requesterId,
        String originalText,
        String correctedText,
        String explanation,
        int reward,
        boolean isAudio
) {}
