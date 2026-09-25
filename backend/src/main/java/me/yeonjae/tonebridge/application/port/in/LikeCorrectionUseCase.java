package me.yeonjae.tonebridge.application.port.in;

import java.util.UUID;

public interface LikeCorrectionUseCase {
    record Command(UUID correctionId, UUID userId) {}

    record Result(boolean liked, int likeCount) {}

    /** 좋아요 — 이미 눌렀으면 그대로(멱등). 재시도·더블탭이 상태를 뒤집지 않는다. */
    Result like(Command command);

    /** 좋아요 취소 — 안 눌렀으면 그대로(멱등). */
    Result unlike(Command command);

    /**
     * 옛 토글 API({@code POST /like}). 재시도가 상태를 뒤집으므로 새 클라이언트는 {@link #like}·{@link #unlike} 를 쓴다.
     * 캐시된 옛 웹 번들이 남아 있는 동안만 유지.
     */
    @Deprecated
    Result toggleLike(Command command);
}
