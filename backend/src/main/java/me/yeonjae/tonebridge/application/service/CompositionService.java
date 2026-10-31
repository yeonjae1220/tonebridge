package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.in.*;
import me.yeonjae.tonebridge.application.port.out.*;
import me.yeonjae.tonebridge.shared.exception.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional
@RequiredArgsConstructor
public class CompositionService implements SaveCompositionUseCase {
    private final CompositionPort receipts;
    private final StudySessionService sessions;
    private final StudyCardService cards;
    private final CardNativeAudioService audios;
    private final CorrectionRequestService requests;
    private final FriendPort friends;
    private final StudyCardPort cardRecords;
    private final StudySessionPort sessionRecords;
    private final CorrectionRequestPort requestRecords;
    private final StoragePort storage;
    private static final Map<String, String> EXTENSIONS = Map.of(
            "audio/webm", "webm", "audio/mp4", "m4a", "audio/ogg", "ogg", "audio/wav", "wav",
            "audio/mpeg", "mp3", "audio/aac", "aac", "audio/x-aac", "aac", "audio/3gpp", "3gp");

    public StoragePort.PresignedUpload upload(UUID owner, UUID operation, String contentType) {
        if (!EXTENSIONS.containsKey(contentType)) throw new ToneBridgeException(ErrorCode.INVALID_INPUT);
        receipts.lockOwner(owner);
        var receipt = receipts.find(owner, operation).orElse(null);
        if (receipt != null && (receipt.cancelled() || receipt.result() != null || !contentType.equals(receipt.contentType())))
            throw new ToneBridgeException(ErrorCode.CONFLICT);
        String key = receipt == null ? "audio/" + owner + "/" + operation + "." + EXTENSIONS.get(contentType) : receipt.audioKey();
        if (receipt == null) receipts.reserveUpload(owner, operation, key, contentType);
        return storage.presignUploadKey(key, contentType, Duration.ofMinutes(15));
    }

    public Result status(UUID owner, UUID operation) {
        receipts.lockOwner(owner);
        var result = receipts.find(owner, operation).map(CompositionPort.Receipt::result).orElse(null);
        if (result == null) throw new ToneBridgeException(ErrorCode.RESOURCE_NOT_FOUND);
        return authorize(owner, result);
    }

    public Result save(UUID owner, UUID operation, Input input) {
        if (input.kind() == Kind.TEXT && blank(input.contentText())
                || input.destination() == Destination.COMMUNITY && blank(input.targetLanguage())
                || input.destination() == Destination.FRIEND && (input.friendId() == null || input.friendId().equals(owner)))
            throw new ToneBridgeException(ErrorCode.INVALID_INPUT);
        receipts.lockOwner(owner);
        String fingerprint = fingerprint(input);
        var receipt = receipts.find(owner, operation).orElse(null);
        if (receipt != null && receipt.cancelled()) throw new ToneBridgeException(ErrorCode.CONFLICT);
        if (receipt != null && receipt.result() != null) {
            if (!fingerprint.equals(receipt.fingerprint())) throw new ToneBridgeException(ErrorCode.CONFLICT);
            return authorize(owner, receipt.result());
        }
        String audioKey = null;
        if (input.kind() == Kind.AUDIO) {
            if (receipt == null || receipt.audioKey() == null
                    || !storage.hasValidAudio(receipt.audioKey(), receipt.contentType()))
                throw new ToneBridgeException(ErrorCode.FILE_NOT_FOUND);
            audioKey = receipt.audioKey();
        }
        Result result;
        if (input.destination() == Destination.COMMUNITY) {
            var request = input.kind() == Kind.TEXT
                    ? requests.submit(new SubmitTextCorrectionRequestUseCase.Command(owner, input.targetLanguage(),
                            input.targetVariant(), input.contentText(), input.context(), input.goals()))
                    : requests.submit(new SubmitAudioCorrectionRequestUseCase.Command(owner, input.targetLanguage(),
                            input.targetVariant(), audioKey, input.context(), input.goals()));
            result = new Result("community", null, null, request.id());
        } else {
            UUID friendId = input.destination() == Destination.FRIEND ? input.friendId() : null;
            if (friendId != null) friends.lockAcceptedBetween(owner, friendId)
                    .orElseThrow(() -> new ToneBridgeException(ErrorCode.NOT_FRIENDS));
            var session = sessions.getSessions(owner).stream()
                    .filter(s -> friendId == null ? s.memberIds().size() == 1
                            : s.memberIds().size() == 2 && s.hasMember(friendId))
                    .findFirst().orElseGet(() -> sessions.create(new CreateStudySessionUseCase.Command(owner, friendId, input.title())));
            String phrase = input.kind() == Kind.TEXT ? input.contentText().trim()
                    : !blank(input.context()) ? input.context().trim() : !blank(input.audioTitle()) ? input.audioTitle() : "Audio";
            if (phrase.length() > 500) throw new ToneBridgeException(ErrorCode.INVALID_INPUT);
            var card = cards.create(new CreateStudyCardUseCase.Command(session.id(), owner, phrase, input.context(), input.goals()));
            if (audioKey != null) audios.confirm(new AddCardNativeAudioUseCase.ConfirmCommand(card.id(), owner, audioKey));
            result = new Result("study", session.id(), card.id(), null);
        }
        receipts.complete(owner, operation, fingerprint, result);
        return result;
    }

    public Result cancel(UUID owner, UUID operation) {
        receipts.lockOwner(owner);
        var receipt = receipts.find(owner, operation).orElse(null);
        if (receipt != null && receipt.result() != null) {
            try { return authorize(owner, receipt.result()); }
            catch (ToneBridgeException exception) {
                if (exception.getErrorCode() == ErrorCode.CONFLICT || exception.getErrorCode() == ErrorCode.NOT_SESSION_MEMBER)
                    return new Result("unavailable", null, null, null);
                throw exception;
            }
        }
        // Tombstone also blocks a late request from another tab after editing.
        receipts.cancel(owner, operation);
        return null;
    }

    private Result authorize(UUID owner, Result result) {
        // A receipt is not a grant to a deleted card or a notebook the owner left.
        // Read ports return Optionals: catching a nested transactional service's
        // exception would leave cancel() rollback-only even for its handled UI result.
        if (result.cardId() != null) {
            var card = cardRecords.findById(result.cardId()).orElseThrow(() -> new ToneBridgeException(ErrorCode.CONFLICT));
            var session = sessionRecords.findById(card.sessionId()).orElseThrow(() -> new ToneBridgeException(ErrorCode.CONFLICT));
            if (!session.hasMember(owner)) throw new ToneBridgeException(ErrorCode.NOT_SESSION_MEMBER);
            return new Result("study", card.sessionId(), card.id(), null);
        }
        requestRecords.findById(result.requestId()).filter(request -> request.isOwnedBy(owner))
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.CONFLICT));
        return result;
    }

    private static boolean blank(String value) { return value == null || value.isBlank(); }
    private static String fingerprint(Input input) {
        try {
            String json = tools.jackson.databind.json.JsonMapper.builder().build().writeValueAsString(input);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }
}
