package me.yeonjae.tonebridge.shared.event;

import java.util.UUID;

/** No names, learning content, audio keys, IPs or tokens. Created only by successful use cases. */
public record LearningActivity(Kind kind, UUID actorId, UUID peerId, UUID sessionId, UUID cardId, UUID attemptId) {
    public enum Kind { FRIEND_ACCEPTED, EXAMPLE_SAVED, PRACTICE_SAVED, FEEDBACK_SAVED }
}
