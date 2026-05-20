package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.studycard.LearnerAttempt;
import me.yeonjae.tonebridge.domain.studycard.StudyCard;

import java.util.List;
import java.util.UUID;

public interface GetStudyCardUseCase {
    StudyCard getCard(UUID cardId, UUID requesterId);
    List<StudyCard> getCards(UUID sessionId, UUID requesterId);
    List<LearnerAttempt> getAttempts(UUID cardId, UUID requesterId);
}
