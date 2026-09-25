package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.correction.CorrectionRequest;

import java.util.UUID;

public interface GetCorrectionRequestUseCase {
    /**
     * 요청자 본인이거나, 아직 교정을 받는 중(PENDING)인 요청만 보인다. 그 밖은 존재 여부도 숨기려고 404.
     * 교정 화면이 피드 목록에서 id 로 찾던 방식을 대체한다 — 피드를 페이지로 나누면 목록에 없는 요청을 못 연다.
     */
    CorrectionRequest get(UUID requestId, UUID viewerId);
}
