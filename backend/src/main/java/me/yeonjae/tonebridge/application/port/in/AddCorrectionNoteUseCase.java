package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.studycard.LearnerAttempt;

import java.util.UUID;

public interface AddCorrectionNoteUseCase {
    record Command(UUID attemptId, UUID reviewerId, String correctionNote, Integer score) {}

    LearnerAttempt addNote(Command command);
}
