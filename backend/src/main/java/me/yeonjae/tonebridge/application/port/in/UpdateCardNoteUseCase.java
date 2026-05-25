package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.studycard.StudyCard;

import java.util.UUID;

public interface UpdateCardNoteUseCase {
    StudyCard updateNote(UUID cardId, UUID requesterId, String note);
}
