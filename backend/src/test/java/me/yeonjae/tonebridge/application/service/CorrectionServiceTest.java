package me.yeonjae.tonebridge.application.service;

import me.yeonjae.tonebridge.application.port.in.AcceptCorrectionUseCase;
import me.yeonjae.tonebridge.application.port.in.LikeCorrectionUseCase;
import me.yeonjae.tonebridge.application.port.out.AiQualityCheckPort;
import me.yeonjae.tonebridge.application.port.out.CorrectionPort;
import me.yeonjae.tonebridge.application.port.out.CorrectionRequestPort;
import me.yeonjae.tonebridge.application.port.out.RatingPort;
import me.yeonjae.tonebridge.application.port.in.UpdateCorrectionUseCase;
import me.yeonjae.tonebridge.domain.correction.Correction;
import me.yeonjae.tonebridge.domain.correction.CorrectionRequest;
import me.yeonjae.tonebridge.domain.correction.CorrectionStatus;
import me.yeonjae.tonebridge.domain.correction.CorrectionType;
import me.yeonjae.tonebridge.domain.correction.RequestStatus;
import me.yeonjae.tonebridge.shared.config.ToneBridgeProperties;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CorrectionServiceTest {

    @Mock
    private CorrectionRequestPort correctionRequestPort;

    @Mock
    private CorrectionPort correctionPort;

    @Mock
    private RatingPort ratingPort;

    @Mock
    private AiQualityCheckPort aiQualityCheckPort;

    @Mock
    private ReputationService reputationService;

    @Mock
    private me.yeonjae.tonebridge.application.port.out.CreditPort creditPort;

    private CorrectionService correctionService;

    @BeforeEach
    void setUp() {
        correctionService = new CorrectionService(
                correctionRequestPort,
                correctionPort,
                ratingPort,
                aiQualityCheckPort,
                new ToneBridgeProperties(),
                reputationService,
                creditPort
        );
    }

    @Test
    void requesterCanReadAllCorrectionsForOwnRequest() {
        UUID requesterId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        CorrectionRequest request = request(requestId, requesterId);
        List<Correction> corrections = List.of(correction(requestId, UUID.randomUUID()));

        when(correctionRequestPort.findById(requestId)).thenReturn(Optional.of(request));
        when(correctionPort.findByRequestId(requestId)).thenReturn(corrections);
        when(correctionPort.findLikeCountsByCorrectionIds(any())).thenReturn(Map.of());
        when(correctionPort.findLikedCorrectionIds(any(), any())).thenReturn(Set.of());

        var result = correctionService.getResult(requestId, requesterId);
        assertThat(result).hasSize(corrections.size());
        assertThat(result.get(0).correction()).isEqualTo(corrections.get(0));
    }

    @Test
    void correctorCanReadOnlyOwnCorrectionsForRequest() {
        UUID requesterId = UUID.randomUUID();
        UUID correctorId = UUID.randomUUID();
        UUID otherCorrectorId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        Correction ownCorrection = correction(requestId, correctorId);
        Correction otherCorrection = correction(requestId, otherCorrectorId);

        when(correctionRequestPort.findById(requestId)).thenReturn(Optional.of(request(requestId, requesterId)));
        when(correctionPort.findByRequestId(requestId)).thenReturn(List.of(ownCorrection, otherCorrection));
        when(correctionPort.findLikeCountsByCorrectionIds(any())).thenReturn(Map.of());
        when(correctionPort.findLikedCorrectionIds(any(), any())).thenReturn(Set.of());

        var result = correctionService.getResult(requestId, correctorId);
        assertThat(result).hasSize(1);
        assertThat(result.get(0).correction()).isEqualTo(ownCorrection);
    }

    @Test
    void unrelatedUserCannotReadCorrections() {
        UUID requesterId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        UUID unrelatedUserId = UUID.randomUUID();

        when(correctionRequestPort.findById(requestId)).thenReturn(Optional.of(request(requestId, requesterId)));
        when(correctionPort.findByRequestId(requestId))
                .thenReturn(List.of(correction(requestId, UUID.randomUUID())));

        assertThatThrownBy(() -> correctionService.getResult(requestId, unrelatedUserId))
                .isInstanceOf(ToneBridgeException.class)
                .extracting(e -> ((ToneBridgeException) e).getErrorCode())
                .isEqualTo(ErrorCode.UNAUTHORIZED);
    }

    @Test
    void onlyRequesterCanRateCorrection() {
        UUID requesterId = UUID.randomUUID();
        UUID attackerId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        UUID correctionId = UUID.randomUUID();

        when(correctionPort.findById(correctionId))
                .thenReturn(Optional.of(correction(correctionId, requestId, UUID.randomUUID())));
        when(correctionRequestPort.findById(requestId)).thenReturn(Optional.of(request(requestId, requesterId)));

        assertThatThrownBy(() ->
                correctionService.rate(new me.yeonjae.tonebridge.application.port.in.RateCorrectionUseCase.Command(
                        correctionId, attackerId, true
                )))
                .isInstanceOf(ToneBridgeException.class)
                .extracting(e -> ((ToneBridgeException) e).getErrorCode())
                .isEqualTo(ErrorCode.UNAUTHORIZED);
        verify(ratingPort, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void onlyCorrectorCanUpdateCorrection() {
        UUID correctorId = UUID.randomUUID();
        UUID attackerId = UUID.randomUUID();
        UUID correctionId = UUID.randomUUID();
        Correction correction = correction(correctionId, UUID.randomUUID(), correctorId);

        when(correctionPort.findById(correctionId)).thenReturn(Optional.of(correction));

        assertThatThrownBy(() -> correctionService.update(new UpdateCorrectionUseCase.Command(
                correctionId, attackerId, "new text", "new explanation", List.of(),
                List.of(), null, null, null, null
        )))
                .isInstanceOf(ToneBridgeException.class)
                .extracting(e -> ((ToneBridgeException) e).getErrorCode())
                .isEqualTo(ErrorCode.UNAUTHORIZED);
        verify(correctionPort, never()).updateContent(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any()
        );
    }

    @Test
    void correctorCanSoftDeleteOwnCorrection() {
        UUID correctorId = UUID.randomUUID();
        UUID correctionId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();

        when(correctionPort.findById(correctionId))
                .thenReturn(Optional.of(correction(correctionId, requestId, correctorId)));
        when(correctionPort.findByRequestId(requestId))
                .thenReturn(List.of(
                        correction(correctionId, requestId, correctorId),
                        correction(UUID.randomUUID(), requestId, UUID.randomUUID())
                ));

        correctionService.delete(correctionId, correctorId);

        verify(correctionPort).softDelete(correctionId);
    }

    @Test
    void cannotDeleteApprovedCorrection() {
        UUID correctorId = UUID.randomUUID();
        UUID correctionId = UUID.randomUUID();
        Correction approved = new Correction(
                correctionId, UUID.randomUUID(), correctorId, false,
                "corrected", "explanation", List.of(), List.of(),
                null, null, null, null, 4, CorrectionStatus.APPROVED, Instant.now()
        );

        when(correctionPort.findById(correctionId)).thenReturn(Optional.of(approved));

        assertThatThrownBy(() -> correctionService.delete(correctionId, correctorId))
                .isInstanceOf(ToneBridgeException.class)
                .extracting(e -> ((ToneBridgeException) e).getErrorCode())
                .isEqualTo(ErrorCode.CORRECTION_DELETE_NOT_ALLOWED);
        verify(correctionPort, never()).softDelete(correctionId);
    }

    @Test
    void cannotDeleteLastVisibleCorrection() {
        UUID correctorId = UUID.randomUUID();
        UUID correctionId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        Correction correction = correction(correctionId, requestId, correctorId);

        when(correctionPort.findById(correctionId)).thenReturn(Optional.of(correction));
        when(correctionPort.findByRequestId(requestId)).thenReturn(List.of(correction));

        assertThatThrownBy(() -> correctionService.delete(correctionId, correctorId))
                .isInstanceOf(ToneBridgeException.class)
                .extracting(e -> ((ToneBridgeException) e).getErrorCode())
                .isEqualTo(ErrorCode.CORRECTION_DELETE_NOT_ALLOWED);
        verify(correctionPort, never()).softDelete(correctionId);
    }

    // ───── Accept 테스트 ─────────────────────────────────────────────────────

    @Test
    void requesterCanAcceptCorrection() {
        UUID requesterId = UUID.randomUUID();
        UUID correctorId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        UUID correctionId = UUID.randomUUID();
        Correction correction = correction(correctionId, requestId, correctorId);
        CorrectionRequest request = pendingRequest(requestId, requesterId);

        when(correctionPort.findById(correctionId)).thenReturn(Optional.of(correction));
        when(correctionRequestPort.findByIdForUpdate(requestId)).thenReturn(Optional.of(request));

        correctionService.accept(new AcceptCorrectionUseCase.Command(correctionId, requesterId));

        verify(correctionPort).updateStatus(correctionId, CorrectionStatus.APPROVED);
        verify(correctionRequestPort).updateAcceptedCorrection(requestId, correctionId);
    }

    @Test
    void nonRequesterCannotAcceptCorrection() {
        UUID requesterId = UUID.randomUUID();
        UUID attackerId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        UUID correctionId = UUID.randomUUID();

        when(correctionPort.findById(correctionId))
                .thenReturn(Optional.of(correction(correctionId, requestId, UUID.randomUUID())));
        when(correctionRequestPort.findByIdForUpdate(requestId))
                .thenReturn(Optional.of(pendingRequest(requestId, requesterId)));

        assertThatThrownBy(() ->
                correctionService.accept(new AcceptCorrectionUseCase.Command(correctionId, attackerId)))
                .isInstanceOf(ToneBridgeException.class)
                .extracting(e -> ((ToneBridgeException) e).getErrorCode())
                .isEqualTo(ErrorCode.UNAUTHORIZED);
        verify(correctionRequestPort, never()).updateAcceptedCorrection(any(), any());
    }

    @Test
    void cannotAcceptWhenAlreadyAccepted() {
        UUID requesterId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        UUID correctionId = UUID.randomUUID();
        CorrectionRequest alreadyAccepted = requestWithAccepted(requestId, requesterId, UUID.randomUUID());

        when(correctionPort.findById(correctionId))
                .thenReturn(Optional.of(correction(correctionId, requestId, UUID.randomUUID())));
        when(correctionRequestPort.findByIdForUpdate(requestId)).thenReturn(Optional.of(alreadyAccepted));

        assertThatThrownBy(() ->
                correctionService.accept(new AcceptCorrectionUseCase.Command(correctionId, requesterId)))
                .isInstanceOf(ToneBridgeException.class)
                .extracting(e -> ((ToneBridgeException) e).getErrorCode())
                .isEqualTo(ErrorCode.CORRECTION_ALREADY_ACCEPTED);
    }

    @Test
    void cannotAcceptExpiredRequest() {
        UUID requesterId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        UUID correctionId = UUID.randomUUID();
        CorrectionRequest expired = requestWithStatus(requestId, requesterId, RequestStatus.EXPIRED);

        when(correctionPort.findById(correctionId))
                .thenReturn(Optional.of(correction(correctionId, requestId, UUID.randomUUID())));
        when(correctionRequestPort.findByIdForUpdate(requestId)).thenReturn(Optional.of(expired));

        assertThatThrownBy(() ->
                correctionService.accept(new AcceptCorrectionUseCase.Command(correctionId, requesterId)))
                .isInstanceOf(ToneBridgeException.class)
                .extracting(e -> ((ToneBridgeException) e).getErrorCode())
                .isEqualTo(ErrorCode.CORRECTION_ALREADY_ACCEPTED);
    }

    @Test
    void cannotAcceptRejectedCorrection() {
        UUID requesterId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        UUID correctionId = UUID.randomUUID();
        Correction rejected = new Correction(
                correctionId, requestId, UUID.randomUUID(), false,
                "corrected", "explanation", List.of(), List.of(),
                null, null, null, null, 4, CorrectionStatus.REJECTED, Instant.now()
        );

        when(correctionPort.findById(correctionId)).thenReturn(Optional.of(rejected));
        when(correctionRequestPort.findByIdForUpdate(requestId))
                .thenReturn(Optional.of(pendingRequest(requestId, requesterId)));

        assertThatThrownBy(() ->
                correctionService.accept(new AcceptCorrectionUseCase.Command(correctionId, requesterId)))
                .isInstanceOf(ToneBridgeException.class)
                .extracting(e -> ((ToneBridgeException) e).getErrorCode())
                .isEqualTo(ErrorCode.CORRECTION_NOT_ACCEPTABLE);
    }

    // ───── Like 테스트 ────────────────────────────────────────────────────────

    @Test
    void toggleLikeReturnsTrueWhenLiked() {
        UUID correctionId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        when(correctionPort.findById(correctionId))
                .thenReturn(Optional.of(correction(correctionId, UUID.randomUUID(), UUID.randomUUID())));
        when(correctionPort.toggleLike(correctionId, userId)).thenReturn(true);
        when(correctionPort.findLikeCountsByCorrectionIds(List.of(correctionId)))
                .thenReturn(Map.of(correctionId, 1L));

        LikeCorrectionUseCase.Result result =
                correctionService.toggleLike(new LikeCorrectionUseCase.Command(correctionId, userId));

        assertThat(result.liked()).isTrue();
        assertThat(result.likeCount()).isEqualTo(1);
    }

    @Test
    void toggleLikeReturnsFalseWhenUnliked() {
        UUID correctionId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        when(correctionPort.findById(correctionId))
                .thenReturn(Optional.of(correction(correctionId, UUID.randomUUID(), UUID.randomUUID())));
        when(correctionPort.toggleLike(correctionId, userId)).thenReturn(false);
        when(correctionPort.findLikeCountsByCorrectionIds(List.of(correctionId)))
                .thenReturn(Map.of());

        LikeCorrectionUseCase.Result result =
                correctionService.toggleLike(new LikeCorrectionUseCase.Command(correctionId, userId));

        assertThat(result.liked()).isFalse();
        assertThat(result.likeCount()).isEqualTo(0);
    }

    @Test
    void toggleLikeThrowsWhenCorrectionNotFound() {
        UUID correctionId = UUID.randomUUID();

        when(correctionPort.findById(correctionId)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                correctionService.toggleLike(new LikeCorrectionUseCase.Command(correctionId, UUID.randomUUID())))
                .isInstanceOf(ToneBridgeException.class)
                .extracting(e -> ((ToneBridgeException) e).getErrorCode())
                .isEqualTo(ErrorCode.CORRECTION_NOT_FOUND);
        verify(correctionPort, never()).toggleLike(any(), any());
    }

    // ───── 헬퍼 ──────────────────────────────────────────────────────────────

    private CorrectionRequest pendingRequest(UUID requestId, UUID requesterId) {
        return requestWithStatus(requestId, requesterId, RequestStatus.PENDING);
    }

    private CorrectionRequest requestWithStatus(UUID requestId, UUID requesterId, RequestStatus status) {
        Instant now = Instant.now();
        return new CorrectionRequest(
                requestId, requesterId, CorrectionType.TEXT,
                "original", null, "en", null, null, List.of(),
                5, status, null, now, now.plusSeconds(3600), null
        );
    }

    private CorrectionRequest requestWithAccepted(UUID requestId, UUID requesterId, UUID acceptedCorrectionId) {
        Instant now = Instant.now();
        return new CorrectionRequest(
                requestId, requesterId, CorrectionType.TEXT,
                "original", null, "en", null, null, List.of(),
                5, RequestStatus.COMPLETED, null, now, now.plusSeconds(3600), acceptedCorrectionId
        );
    }

    private CorrectionRequest request(UUID requestId, UUID requesterId) {
        Instant now = Instant.now();
        return new CorrectionRequest(
                requestId,
                requesterId,
                CorrectionType.TEXT,
                "original",
                null,
                "en",
                null,
                null,
                List.of(),
                5,
                RequestStatus.COMPLETED,
                null,
                now,
                now.plusSeconds(3600),
                null
        );
    }

    private Correction correction(UUID requestId, UUID correctorId) {
        return correction(UUID.randomUUID(), requestId, correctorId);
    }

    private Correction correction(UUID correctionId, UUID requestId, UUID correctorId) {
        return new Correction(
                correctionId,
                requestId,
                correctorId,
                false,
                "corrected",
                "explanation",
                List.of(),
                List.of(),
                null,
                null,
                null,
                null,
                4,
                CorrectionStatus.SUBMITTED,
                Instant.now()
        );
    }
}
