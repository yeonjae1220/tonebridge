package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.studycard.StudyCard;

import java.util.UUID;

public interface MoveStudyCardUseCase {
    StudyCard move(Command command);

    record Command(
            UUID cardId,
            UUID requesterId,
            UUID targetSessionId,
            int position
    ) {}
}
