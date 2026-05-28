package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.in.*;
import me.yeonjae.tonebridge.application.port.out.*;
import me.yeonjae.tonebridge.domain.session.StudySession;
import me.yeonjae.tonebridge.domain.studycard.LearnerAttempt;
import me.yeonjae.tonebridge.domain.studycard.StudyCard;
import me.yeonjae.tonebridge.domain.user.User;
import me.yeonjae.tonebridge.shared.event.CorrectionNoteAddedEvent;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
public class StudyCardService implements
        GetStudyCardUseCase,
        CreateStudyCardUseCase,
        UploadNativeAudioUseCase,
        GetNativeAudioDownloadUrlUseCase,
        SubmitLearnerAttemptUseCase,
        AddCorrectionNoteUseCase,
        UpdateCardNoteUseCase,
        UpdateStudyCardUseCase,
        MoveStudyCardUseCase,
        DeleteStudyCardUseCase {

    private final StudyCardPort cardPort;
    private final LearnerAttemptPort attemptPort;
    private final CardNativeAudioPort nativeAudioPort;
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
        List<StudyCard> cards = cardPort.findBySessionId(sessionId);

        // Batch-fetch the latest attempt for all cards in a single query (avoids N+1)
        Set<UUID> cardIds = cards.stream().map(StudyCard::id).collect(Collectors.toSet());
        Map<UUID, LearnerAttempt> latestAttempts = attemptPort.findLatestByCardIds(cardIds);

        return cards.stream()
                .map(card -> card.withLatestAttempt(latestAttempts.get(card.id())))
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
        requireActive(session);

        int nextPosition = cardPort.findBySessionId(command.sessionId()).size();
        StudyCard card = new StudyCard(null, command.sessionId(), command.creatorId(),
                command.phrase(), command.context(), null, null, command.tags(), nextPosition, null, null, null);
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
        requireActiveMember(card.sessionId(), command.uploaderId());
        var presigned = storagePort.generatePresignedUploadUrl(
                command.fileName(),
                AudioContentTypes.fromFileName(command.fileName()),
                Duration.ofMinutes(15));
        return new UploadUrlResult(presigned.uploadUrl(), presigned.audioKey());
    }

    @Override
    public StudyCard upload(UploadNativeAudioUseCase.Command command) {
        StudyCard card = cardPort.findById(command.cardId())
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.CARD_NOT_FOUND));
        requireActiveMember(card.sessionId(), command.uploaderId());
        return cardPort.save(card.withNativeAudio(command.audioKey()));
    }

    // ─── GetNativeAudioDownloadUrlUseCase ─────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public String getDownloadUrl(UUID cardId, UUID requesterId) {
        StudyCard card = cardPort.findById(cardId)
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.CARD_NOT_FOUND));
        requireMember(card.sessionId(), requesterId);
        if (!card.hasNativeAudio()) {
            throw new ToneBridgeException(ErrorCode.FILE_NOT_FOUND);
        }
        return storagePort.generatePresignedDownloadUrl(card.nativeAudioUrl(), Duration.ofMinutes(15));
    }

    // ─── SubmitLearnerAttemptUseCase ───────────────────────────────────────

    @Override
    public LearnerAttempt submit(SubmitLearnerAttemptUseCase.Command command) {
        StudyCard card = cardPort.findById(command.cardId())
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.CARD_NOT_FOUND));

        if (card.createdByUserId().equals(command.learnerId())) {
            throw new ToneBridgeException(ErrorCode.CANNOT_ATTEMPT_OWN_CARD);
        }

        requireActiveMember(card.sessionId(), command.learnerId());

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

        requireActiveMember(card.sessionId(), command.reviewerId());

        LearnerAttempt updated = attemptPort.save(attempt.withCorrection(command.correctionNote(), command.score()));

        String reviewerUsername = userPort.findById(command.reviewerId())
                .map(User::username).orElse("파트너");
        eventPublisher.publishEvent(
                new CorrectionNoteAddedEvent(attempt.learnerId(), card.id(), card.sessionId(), reviewerUsername));

        return updated;
    }

    // ─── UpdateCardNoteUseCase ─────────────────────────────────────────────

    @Override
    public StudyCard updateNote(UUID cardId, UUID requesterId, String note) {
        StudyCard card = cardPort.findById(cardId)
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.CARD_NOT_FOUND));
        requireActiveMember(card.sessionId(), requesterId);
        return cardPort.save(card.withNote(note));
    }

    @Override
    public StudyCard update(UpdateStudyCardUseCase.Command command) {
        StudyCard card = cardPort.findById(command.cardId())
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.CARD_NOT_FOUND));
        requireCardCreator(card, command.requesterId());
        requireActiveMember(card.sessionId(), command.requesterId());
        return cardPort.updateContent(
                command.cardId(),
                command.phrase(),
                command.context(),
                command.tags() != null ? command.tags() : List.of()
        );
    }

    @Override
    public StudyCard move(MoveStudyCardUseCase.Command command) {
        StudyCard card = cardPort.findById(command.cardId())
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.CARD_NOT_FOUND));
        requireCardCreator(card, command.requesterId());
        StudySession sourceSession = requireActiveMember(card.sessionId(), command.requesterId());
        StudySession targetSession = requireActiveMember(command.targetSessionId(), command.requesterId());
        if (!sourceSession.id().equals(targetSession.id()) && hasLearningHistory(card)) {
            throw new ToneBridgeException(ErrorCode.CARD_HAS_HISTORY);
        }
        return cardPort.move(command.cardId(), command.targetSessionId(), command.position());
    }

    @Override
    public void delete(UUID cardId, UUID requesterId) {
        StudyCard card = cardPort.findById(cardId)
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.CARD_NOT_FOUND));
        requireCardCreator(card, requesterId);
        requireActiveMember(card.sessionId(), requesterId);
        cardPort.softDelete(cardId);
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

    private StudySession requireActiveMember(UUID sessionId, UUID userId) {
        StudySession session = requireSession(sessionId);
        requireMemberInSession(session, userId);
        requireActive(session);
        return session;
    }

    private void requireMemberInSession(StudySession session, UUID userId) {
        if (!session.hasMember(userId)) {
            throw new ToneBridgeException(ErrorCode.NOT_SESSION_MEMBER);
        }
    }

    private void requireActive(StudySession session) {
        if (!session.isActive()) {
            throw new ToneBridgeException(ErrorCode.SESSION_ALREADY_ENDED);
        }
    }

    private boolean hasLearningHistory(StudyCard card) {
        return card.hasNativeAudio()
                || !attemptPort.findByCardId(card.id()).isEmpty()
                || !nativeAudioPort.findAllByCardId(card.id()).isEmpty();
    }

    private void requireCardCreator(StudyCard card, UUID userId) {
        if (!card.createdByUserId().equals(userId)) {
            throw new ToneBridgeException(ErrorCode.UNAUTHORIZED);
        }
    }
}
