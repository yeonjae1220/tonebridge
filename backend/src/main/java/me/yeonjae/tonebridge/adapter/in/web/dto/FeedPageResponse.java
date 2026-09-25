package me.yeonjae.tonebridge.adapter.in.web.dto;

import me.yeonjae.tonebridge.application.port.in.GetCorrectionFeedUseCase;

import java.util.List;

/** {@code nextCursor} 가 null 이면 마지막 페이지다. */
public record FeedPageResponse(List<CorrectionRequestResponse> items, String nextCursor) {

    public static FeedPageResponse from(GetCorrectionFeedUseCase.FeedPage page) {
        return new FeedPageResponse(
                page.items().stream().map(CorrectionRequestResponse::from).toList(),
                page.nextCursor());
    }
}
