package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.in.*;
import me.yeonjae.tonebridge.application.port.out.*;
import me.yeonjae.tonebridge.domain.correction.Correction;
import me.yeonjae.tonebridge.domain.studycard.StudyCard;
import me.yeonjae.tonebridge.domain.studycard.LearnerAttempt;
import me.yeonjae.tonebridge.domain.studycard.CardNativeAudio;
import me.yeonjae.tonebridge.shared.exception.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;

@Service
@Transactional
@RequiredArgsConstructor
public class SubmissionService {
    public record Result(String type, UUID resourceId, UUID parentId) {}
    private final UserBlockService userBlocks;
    private final CloudDraftService cloudDrafts;
    private final SubmissionPort receipts;
    private final SubmitCorrectionUseCase corrections;
    private final CreateStudyCardUseCase cards;
    private final CorrectionPort correctionRecords;
    private final CorrectionRequestPort requests;
    private final StudyCardPort cardRecords;
    private final StudySessionPort sessions;
    private final SubmitLearnerAttemptUseCase attempts;
    private final AddCardNativeAudioUseCase examples;
    private final LearnerAttemptPort attemptRecords;
    private final CardNativeAudioPort exampleRecords;
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;

    public Correction submit(UUID operation, SubmitCorrectionUseCase.Command command) {
        if (operation == null) return corrections.submit(command); // Older clients remain compatible.
        UUID owner = command.correctorId();
        // Preserve receipt replay semantics for deleted parents, while ordering pair locks first.
        requests.findById(command.requestId()).ifPresent(request -> userBlocks.lockAllowed(owner, request.requesterId()));
        receipts.lockOwner(owner);
        String fingerprint = fingerprint(command);
        var receipt = matching(owner, operation, "CORRECTION", fingerprint);
        if (receipt != null) return correction(owner, receipt.resourceId());
        var result = corrections.submit(command);
        receipts.complete(owner, operation, "CORRECTION", fingerprint, result.id());
        cloudDrafts.completeSubmission(owner,operation,"SUBMISSION");
        return result;
    }
    public StudyCard create(UUID operation, CreateStudyCardUseCase.Command command) {
        if (operation == null) return cards.create(command);
        UUID owner = command.creatorId();
        receipts.lockOwner(owner);
        String fingerprint = fingerprint(command);
        var receipt = matching(owner, operation, "CARD", fingerprint);
        if (receipt != null) return card(owner, receipt.resourceId());
        var result = cards.create(command);
        receipts.complete(owner, operation, "CARD", fingerprint, result.id());
        cloudDrafts.completeSubmission(owner,operation,"SUBMISSION");
        return result;
    }
    public LearnerAttempt attempt(UUID operation,SubmitLearnerAttemptUseCase.Command command) {
        if(operation==null)return attempts.submit(command);
        UUID owner=command.learnerId();receipts.lockOwner(owner);String hash=fingerprint(command);
        var receipt=matching(owner,operation,"PRACTICE",hash);if(receipt!=null)return attempt(owner,receipt.resourceId());
        requireOwnedUpload(owner,command.audioKey());var result=attempts.submit(command);
        receipts.complete(owner,operation,"PRACTICE",hash,result.id());cloudDrafts.completeSubmission(owner,operation,"SUBMISSION");return result;
    }
    public CardNativeAudio example(UUID operation,AddCardNativeAudioUseCase.ConfirmCommand command) {
        if(operation==null)return examples.confirm(command);
        UUID owner=command.uploaderId();receipts.lockOwner(owner);String hash=fingerprint(command);
        var receipt=matching(owner,operation,"EXAMPLE",hash);if(receipt!=null)return example(owner,receipt.resourceId());
        requireOwnedUpload(owner,command.audioKey());var result=examples.confirm(command);
        receipts.complete(owner,operation,"EXAMPLE",hash,result.id());cloudDrafts.completeSubmission(owner,operation,"SUBMISSION");return result;
    }
    private void requireOwnedUpload(UUID owner,String key) {
        if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM audio_upload_owners WHERE owner_id=? AND audio_key=?)",Boolean.class,owner,key)))throw new ToneBridgeException(ErrorCode.INVALID_AUDIO_KEY);
    }
    private LearnerAttempt attempt(UUID owner,UUID id) {
        var value=attemptRecords.findById(id).filter(a -> owner.equals(a.learnerId())).orElseThrow(() -> new ToneBridgeException(ErrorCode.CONFLICT));
        accessibleAudioCard(owner,value.cardId());return value;
    }
    private CardNativeAudio example(UUID owner,UUID id) {
        var value=exampleRecords.findById(id).orElseThrow(() -> new ToneBridgeException(ErrorCode.CONFLICT));
        requireOwnedUpload(owner,value.audioKey());accessibleAudioCard(owner,value.cardId());return value;
    }
    private void accessibleAudioCard(UUID owner,UUID id) {
        var card=cardRecords.findById(id).orElseThrow(() -> new ToneBridgeException(ErrorCode.CONFLICT));
        var session=sessions.findById(card.sessionId()).orElseThrow(() -> new ToneBridgeException(ErrorCode.CONFLICT));
        if(!session.hasMember(owner))throw new ToneBridgeException(ErrorCode.NOT_SESSION_MEMBER);
    }
    private SubmissionPort.Receipt matching(UUID owner, UUID operation, String kind, String fingerprint) {
        var receipt = receipts.find(owner, operation).orElse(null);
        if (receipt != null && (receipt.cancelled() || !kind.equals(receipt.kind()) || !fingerprint.equals(receipt.fingerprint())))
            throw new ToneBridgeException(ErrorCode.CONFLICT);
        return receipt;
    }
    public Result status(UUID owner, UUID operation) {
        receipts.lockOwner(owner);
        var receipt = receipts.find(owner, operation).orElseThrow(() -> new ToneBridgeException(ErrorCode.RESOURCE_NOT_FOUND));
        return result(owner, receipt);
    }
    public Result cancel(UUID owner, UUID operation) {
        receipts.lockOwner(owner);
        var receipt = receipts.find(owner, operation).orElse(null);
        if (receipt != null && !receipt.cancelled()) {
            try { return result(owner, receipt); }
            catch (ToneBridgeException exception) {
                if (exception.getErrorCode() == ErrorCode.CONFLICT || exception.getErrorCode() == ErrorCode.NOT_SESSION_MEMBER)
                    return new Result("unavailable", null, null);
                throw exception;
            }
        }
        receipts.cancel(owner, operation);
        cloudDrafts.cancelledSubmission(owner,operation,"SUBMISSION"); // Also blocks a request still on its way to the server.
        return new Result("cancelled", null, null);
    }
    private Result result(UUID owner, SubmissionPort.Receipt receipt) {
        if (receipt.cancelled()) return new Result("cancelled", null, null);
        if(receipt.kind().equals("PRACTICE")){var value=attempt(owner,receipt.resourceId());return new Result("practice",value.id(),value.cardId());}
        if(receipt.kind().equals("EXAMPLE")){var value=example(owner,receipt.resourceId());return new Result("example",value.id(),value.cardId());}
        if (receipt.kind().equals("CORRECTION")) {
            var correction = correction(owner, receipt.resourceId());
            return new Result("correction", correction.id(), correction.requestId());
        }
        var card = card(owner, receipt.resourceId());
        return new Result("card", card.id(), card.sessionId());
    }
    private Correction correction(UUID owner, UUID id) {
        var correction = correctionRecords.findById(id).filter(c -> owner.equals(c.correctorId()))
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.CONFLICT));
        requests.findById(correction.requestId()).orElseThrow(() -> new ToneBridgeException(ErrorCode.CONFLICT));
        return correction;
    }
    private StudyCard card(UUID owner, UUID id) {
        var card = cardRecords.findById(id).filter(c -> owner.equals(c.createdByUserId()))
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.CONFLICT));
        var session = sessions.findById(card.sessionId()).orElseThrow(() -> new ToneBridgeException(ErrorCode.CONFLICT));
        if (!session.hasMember(owner)) throw new ToneBridgeException(ErrorCode.NOT_SESSION_MEMBER);
        return card;
    }
    private static String fingerprint(Object input) {
        try {
            String json = tools.jackson.databind.json.JsonMapper.builder().build().writeValueAsString(input);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }
}
