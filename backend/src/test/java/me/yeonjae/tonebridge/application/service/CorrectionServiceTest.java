package me.yeonjae.tonebridge.application.service;

import me.yeonjae.tonebridge.application.port.out.AiQualityCheckPort;
import me.yeonjae.tonebridge.application.port.out.CorrectionPort;
import me.yeonjae.tonebridge.application.port.out.CorrectionRequestPort;
import me.yeonjae.tonebridge.application.port.out.RatingPort;
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
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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

    private CorrectionService correctionService;

    @BeforeEach
    void setUp() {
        correctionService = new CorrectionService(
                correctionRequestPort,
                correctionPort,
                ratingPort,
                aiQualityCheckPort,
                new ToneBridgeProperties(),
                reputationService
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

        assertThat(correctionService.getResult(requestId, requesterId)).isEqualTo(corrections);
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

        assertThat(correctionService.getResult(requestId, correctorId)).containsExactly(ownCorrection);
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
                List.of(),
                5,
                RequestStatus.COMPLETED,
                null,
                now,
                now.plusSeconds(3600)
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
