package me.yeonjae.tonebridge.application.port.in;

import java.util.UUID;

public interface DeleteStudyCardUseCase {
    void delete(UUID cardId, UUID requesterId);
}
