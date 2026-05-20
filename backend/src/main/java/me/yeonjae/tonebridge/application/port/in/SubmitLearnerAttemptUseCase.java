package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.studycard.LearnerAttempt;

import java.util.UUID;

public interface SubmitLearnerAttemptUseCase {
    record Command(UUID cardId, UUID learnerId, String audioKey) {}

    LearnerAttempt submit(Command command);
}
