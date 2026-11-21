package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.studycard.LearnerAttempt;

import java.util.List;
import java.util.UUID;

public interface AddCorrectionNoteUseCase {
    /**
     * @param soundGuideIds sounds the feedback points at, in order; {@code null} leaves the stored ones
     *                      unchanged (older clients do not send them) and an empty list clears them.
     */
    record Command(UUID attemptId, UUID reviewerId, String correctionNote, Integer score, List<String> soundGuideIds) {
        public Command(UUID attemptId, UUID reviewerId, String correctionNote, Integer score) {
            this(attemptId, reviewerId, correctionNote, score, null);
        }
    }

    LearnerAttempt addNote(Command command);
}
