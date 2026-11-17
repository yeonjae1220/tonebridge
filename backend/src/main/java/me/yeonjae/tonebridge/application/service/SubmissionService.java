package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.in.*;
import me.yeonjae.tonebridge.application.port.out.*;
import me.yeonjae.tonebridge.domain.correction.Correction;
import me.yeonjae.tonebridge.domain.studycard.StudyCard;
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
