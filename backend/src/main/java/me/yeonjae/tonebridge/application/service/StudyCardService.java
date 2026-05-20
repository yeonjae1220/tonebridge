package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.in.*;
import me.yeonjae.tonebridge.application.port.out.*;
import me.yeonjae.tonebridge.domain.session.StudySession;
import me.yeonjae.tonebridge.domain.studycard.LearnerAttempt;
import me.yeonjae.tonebridge.domain.studycard.StudyCard;
import me.yeonjae.tonebridge.shared.event.CorrectionNoteAddedEvent;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
@RequiredArgsConstructor
public class StudyCardService implements
        GetStudyCardUseCase,
        CreateStudyCardUseCase,
        UploadNativeAudioUseCase,
        SubmitLearnerAttemptUseCase,
        AddCorrectionNoteUseCase {

    private final StudyCardPort cardPort;
    private final LearnerAttemptPort attemptPort;
    private final StudySessionPort sessionPort;
    private final StoragePort storagePort;
    private final UserPort userPort;
    private final FcmNotificationPort fcmNotificationPort;
    private final ApplicationEventPublisher eventPublisher;

    // ─── GetStudyCardUseCase ───────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public StudyCard getCard(UUID cardId, UUID requesterId) {
        StudyCard card = cardPort.findById(cardId)
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.CARD_NOT_FOUND));
        requireMember(card.sessionId(), requesterId);
        return card;
    }

    @Override
    @Transactional(readOnly = true)
    public List<StudyCard> getCards(UUID sessionId, UUID requesterId) {
        requireMember(sessionId, requesterId);
        return cardPort.findBySessionId(sessionId).stream()
                .map(card -> {
                    LearnerAttempt latest = attemptPort.findLatestByCardId(card.id()).orElse(null);
                    return card.withLatestAttempt(latest);
                })
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<LearnerAttempt> getAttempts(UUID cardId, UUID requesterId) {
        StudyCard card = cardPort.findById(cardId)
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.CARD_NOT_FOUND));
        requireMember(card.sessionId(), requesterId);
        return attemptPort.findByCardId(cardId);
    }

    // ─── CreateStudyCardUseCase ────────────────────────────────────────────

    @Override
    public StudyCard create(CreateStudyCardUseCase.Command command) {
        StudySession session = requireSession(command.sessionId());
        requireMemberInSession(session, command.creatorId());

        StudyCard card = new StudyCard(null, command.sessionId(), command.creatorId(),
                command.phrase(), command.context(), null, null, command.tags(), null, null);
        StudyCard saved = cardPort.save(card);

        session.memberIds().stream()
                .filter(id -> !id.equals(command.creatorId()))
                .forEach(memberId -> fcmNotificationPort.sendNewStudyCard(memberId, session.id(), saved.phrase()));

        return saved;
    }

    // ─── UploadNativeAudioUseCase ──────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public UploadUrlResult getUploadUrl(GetUrlCommand command) {
        StudyCard card = cardPort.findById(command.cardId())
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.CARD_NOT_FOUND));
        requireMember(card.sessionId(), command.uploaderId());
        var presigned = storagePort.generatePresignedUploadUrl(
                command.fileName(), "audio/aac", Duration.ofMinutes(15));
        return new UploadUrlResult(presigned.uploadUrl(), presigned.audioKey());
    }

    @Override
    public StudyCard upload(UploadNativeAudioUseCase.Command command) {
        StudyCard card = cardPort.findById(command.cardId())
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.CARD_NOT_FOUND));
        requireMember(card.sessionId(), command.uploaderId());
        return cardPort.save(card.withNativeAudio(command.audioKey()));
    }

    // ─── SubmitLearnerAttemptUseCase ───────────────────────────────────────

    @Override
    public LearnerAttempt submit(SubmitLearnerAttemptUseCase.Command command) {
        StudyCard card = cardPort.findById(command.cardId())
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.CARD_NOT_FOUND));

        if (card.createdByUserId().equals(command.learnerId())) {
            throw new ToneBridgeException(ErrorCode.CANNOT_ATTEMPT_OWN_CARD);
        }

        requireMember(card.sessionId(), command.learnerId());

        LearnerAttempt attempt = new LearnerAttempt(
                null, command.cardId(), command.learnerId(), command.audioKey(), null, null, null);
        return attemptPort.save(attempt);
    }

    // ─── AddCorrectionNoteUseCase ──────────────────────────────────────────

    @Override
    public LearnerAttempt addNote(AddCorrectionNoteUseCase.Command command) {
        LearnerAttempt attempt = attemptPort.findById(command.attemptId())
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.ATTEMPT_NOT_FOUND));

        StudyCard card = cardPort.findById(attempt.cardId())
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.CARD_NOT_FOUND));

        requireMember(card.sessionId(), command.reviewerId());

        LearnerAttempt updated = attemptPort.save(attempt.withCorrection(command.correctionNote(), command.score()));

        String reviewerUsername = userPort.findById(command.reviewerId())
                .map(u -> u.username()).orElse("파트너");
        eventPublisher.publishEvent(
                new CorrectionNoteAddedEvent(attempt.learnerId(), card.id(), reviewerUsername));

        return updated;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────

    private StudySession requireSession(UUID sessionId) {
        return sessionPort.findById(sessionId)
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.SESSION_NOT_FOUND));
    }

    private void requireMember(UUID sessionId, UUID userId) {
        StudySession session = requireSession(sessionId);
        requireMemberInSession(session, userId);
    }

    private void requireMemberInSession(StudySession session, UUID userId) {
        if (!session.hasMember(userId)) {
            throw new ToneBridgeException(ErrorCode.NOT_SESSION_MEMBER);
        }
    }
}
