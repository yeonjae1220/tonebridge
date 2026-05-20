package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.studycard.StudyCard;

import java.util.List;
import java.util.UUID;

public interface CreateStudyCardUseCase {
    record Command(UUID sessionId, UUID creatorId, String phrase, String context, List<String> tags) {}

    StudyCard create(Command command);
}
