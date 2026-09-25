package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.application.port.in.GetCorrectionFeedUseCase.FeedCursor;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FeedCursorTest {

    @Test
    void 인코딩_후_디코딩하면_같은_지점이다_마이크로초까지() {
        // PostgreSQL timestamptz 는 마이크로초 정밀도 — 잘리면 같은 시각 요청 사이에서 누락·중복이 생긴다.
        FeedCursor cursor = new FeedCursor(true, Instant.parse("2026-09-25T06:00:00.123456Z"), UUID.randomUUID());

        assertThat(FeedCursor.decode(cursor.encode())).isEqualTo(cursor);
    }

    @ParameterizedTest
    @ValueSource(strings = {"not-base64!!", "", "MXwyMDI2"})
    void 형식이_틀린_커서는_400(String encoded) {
        assertThatThrownBy(() -> FeedCursor.decode(encoded))
                .isInstanceOf(ToneBridgeException.class)
                .extracting(e -> ((ToneBridgeException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_INPUT);
    }

    @Test
    void 선호_플래그가_0이나_1이_아니면_400() {
        String raw = "2|2026-09-25T06:00:00Z|" + UUID.randomUUID();
        String encoded = Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> FeedCursor.decode(encoded)).isInstanceOf(ToneBridgeException.class);
    }
}
