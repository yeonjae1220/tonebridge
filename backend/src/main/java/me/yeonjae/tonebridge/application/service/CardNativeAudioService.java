package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.in.AddCardNativeAudioUseCase;
import me.yeonjae.tonebridge.application.port.in.DeleteCardNativeAudioUseCase;
import me.yeonjae.tonebridge.application.port.in.GetCardNativeAudiosUseCase;
import me.yeonjae.tonebridge.application.port.in.UpdateNativeAudioNoteUseCase;
import me.yeonjae.tonebridge.application.port.in.UploadNativeAudioUseCase;
import me.yeonjae.tonebridge.application.port.out.CardNativeAudioPort;
import me.yeonjae.tonebridge.application.port.out.StoragePort;
import me.yeonjae.tonebridge.application.port.out.StudyCardPort;
import me.yeonjae.tonebridge.application.port.out.StudySessionPort;
import me.yeonjae.tonebridge.domain.studycard.CardNativeAudio;
import me.yeonjae.tonebridge.domain.studycard.StudyCard;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
@RequiredArgsConstructor
public class CardNativeAudioService implements
        AddCardNativeAudioUseCase,
        GetCardNativeAudiosUseCase,
        DeleteCardNativeAudioUseCase,
        UpdateNativeAudioNoteUseCase {

    private final CardNativeAudioPort nativeAudioPort;
    private final StudyCardPort cardPort;
    private final StudySessionPort sessionPort;
    private final StoragePort storagePort;

    // ─── AddCardNativeAudioUseCase ────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public UploadNativeAudioUseCase.UploadUrlResult getUploadUrl(AddCardNativeAudioUseCase.GetUrlCommand command) {
        StudyCard card = requireCard(command.cardId());
        requireMember(card.sessionId(), command.uploaderId());
        var presigned = storagePort.generatePresignedUploadUrl(
                command.fileName(), "audio/aac", Duration.ofMinutes(15));
        return new UploadNativeAudioUseCase.UploadUrlResult(presigned.uploadUrl(), presigned.audioKey());
    }

    @Override
    public CardNativeAudio confirm(AddCardNativeAudioUseCase.ConfirmCommand command) {
        StudyCard card = requireCard(command.cardId());
        requireMember(card.sessionId(), command.uploaderId());
        CardNativeAudio audio = new CardNativeAudio(null, command.cardId(), command.audioKey(), null, null);
        return nativeAudioPort.save(audio);
    }

    // ─── GetCardNativeAudiosUseCase ───────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<CardNativeAudio> getAudios(UUID cardId, UUID requesterId) {
        StudyCard card = requireCard(cardId);
        requireMember(card.sessionId(), requesterId);
        return nativeAudioPort.findAllByCardId(cardId);
    }

    @Override
    @Transactional(readOnly = true)
    public String getDownloadUrl(UUID audioId, UUID requesterId) {
        CardNativeAudio audio = nativeAudioPort.findById(audioId)
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.FILE_NOT_FOUND));
        StudyCard card = requireCard(audio.cardId());
        requireMember(card.sessionId(), requesterId);
        return storagePort.generatePresignedDownloadUrl(audio.audioKey(), Duration.ofMinutes(15));
    }

    // ─── DeleteCardNativeAudioUseCase ─────────────────────────────────────

    @Override
    public void delete(UUID audioId, UUID cardId, UUID requesterId) {
        CardNativeAudio audio = nativeAudioPort.findById(audioId)
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.FILE_NOT_FOUND));
        StudyCard card = requireCard(cardId);
        requireMember(card.sessionId(), requesterId);
        nativeAudioPort.deleteByIdAndCardId(audioId, cardId);
        storagePort.deleteObject(audio.audioKey());
    }

    // ─── UpdateNativeAudioNoteUseCase ─────────────────────────────────────

    @Override
    public CardNativeAudio updateNote(UUID audioId, UUID requesterId, String note) {
        CardNativeAudio audio = nativeAudioPort.findById(audioId)
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.FILE_NOT_FOUND));
        StudyCard card = requireCard(audio.cardId());
        requireMember(card.sessionId(), requesterId);
        return nativeAudioPort.save(audio.withNote(note));
    }

    // ─── Helpers ──────────────────────────────────────────────────────────

    private StudyCard requireCard(UUID cardId) {
        return cardPort.findById(cardId)
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.CARD_NOT_FOUND));
    }

    private void requireMember(UUID sessionId, UUID userId) {
        var session = sessionPort.findById(sessionId)
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.SESSION_NOT_FOUND));
        if (!session.hasMember(userId)) {
            throw new ToneBridgeException(ErrorCode.NOT_SESSION_MEMBER);
        }
    }
}
