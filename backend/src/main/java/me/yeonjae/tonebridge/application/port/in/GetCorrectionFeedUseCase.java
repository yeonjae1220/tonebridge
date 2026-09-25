package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.correction.CorrectionRequest;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

public interface GetCorrectionFeedUseCase {

    /**
     * 피드 정렬 키 (교정자 방언 일치 우선, 최신순, id) 의 한 지점. 이 지점 "다음"부터 읽는다.
     * 클라이언트에는 불투명 문자열로만 준다 — 정렬 키가 바뀌어도 API 가 안 바뀌게.
     */
    record FeedCursor(boolean preferred, Instant createdAt, UUID id) {

        public String encode() {
            String raw = (preferred ? "1" : "0") + "|" + createdAt + "|" + id;
            return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
        }

        public static FeedCursor decode(String encoded) {
            try {
                String raw = new String(Base64.getUrlDecoder().decode(encoded), StandardCharsets.UTF_8);
                String[] parts = raw.split("\\|", -1);
                if (parts.length != 3 || !(parts[0].equals("0") || parts[0].equals("1"))) {
                    throw new IllegalArgumentException("malformed cursor");
                }
                return new FeedCursor(parts[0].equals("1"), Instant.parse(parts[1]), UUID.fromString(parts[2]));
            } catch (IllegalArgumentException | DateTimeParseException e) {
                throw new ToneBridgeException(ErrorCode.INVALID_INPUT);
            }
        }
    }

    record FeedPage(List<CorrectionRequest> items, String nextCursor) {}

    /** {@code after} 가 null 이면 첫 페이지. 다음 페이지가 없으면 {@code nextCursor} 는 null. */
    FeedPage getFeedPage(UUID correctorId, FeedCursor after, int limit);

    /** 옛 배열 응답({@code GET /feed})용 — 설치된 구버전 모바일 앱. 첫 페이지만 준다. */
    @Deprecated
    default List<CorrectionRequest> getFeed(UUID correctorId, int limit) {
        return getFeedPage(correctorId, null, limit).items();
    }
}
