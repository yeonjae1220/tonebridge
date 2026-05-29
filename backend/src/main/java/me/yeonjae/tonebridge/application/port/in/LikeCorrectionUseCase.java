package me.yeonjae.tonebridge.application.port.in;

import java.util.UUID;

public interface LikeCorrectionUseCase {
    record Command(UUID correctionId, UUID userId) {}

    record Result(boolean liked, int likeCount) {}

    Result toggleLike(Command command);
}
