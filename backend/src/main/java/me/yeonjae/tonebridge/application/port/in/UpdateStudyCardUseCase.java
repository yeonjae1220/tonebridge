package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.studycard.StudyCard;

import java.util.List;
import java.util.UUID;

public interface UpdateStudyCardUseCase {
    StudyCard update(Command command);

    record Command(
            UUID cardId,
            UUID requesterId,
            String phrase,
            String context,
            List<String> tags
    ) {}
}
