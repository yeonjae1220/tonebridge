package me.yeonjae.tonebridge.application.port.out;

import me.yeonjae.tonebridge.domain.studycard.StudyCard;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StudyCardPort {
    StudyCard save(StudyCard card);
    Optional<StudyCard> findById(UUID id);
    List<StudyCard> findBySessionId(UUID sessionId);
    StudyCard updateContent(UUID id, String phrase, String context, List<String> tags);
    StudyCard move(UUID id, UUID targetSessionId, int position);
    void softDelete(UUID id);
}
