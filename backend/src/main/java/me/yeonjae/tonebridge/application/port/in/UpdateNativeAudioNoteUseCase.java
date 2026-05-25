package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.studycard.CardNativeAudio;

import java.util.UUID;

public interface UpdateNativeAudioNoteUseCase {
    CardNativeAudio updateNote(UUID audioId, UUID requesterId, String note);
}
