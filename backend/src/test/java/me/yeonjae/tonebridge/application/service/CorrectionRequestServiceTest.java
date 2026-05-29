package me.yeonjae.tonebridge.application.service;

import me.yeonjae.tonebridge.application.port.out.CorrectionPort;
import me.yeonjae.tonebridge.application.port.out.CorrectionRequestPort;
import me.yeonjae.tonebridge.application.port.out.CreditPort;
import me.yeonjae.tonebridge.application.port.out.LanguageVariantPort;
import me.yeonjae.tonebridge.application.port.out.UserPort;
import me.yeonjae.tonebridge.domain.correction.CorrectionRequest;
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

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CorrectionRequestServiceTest {

    @Mock
    private CorrectionRequestPort correctionRequestPort;

    @Mock
    private CorrectionPort correctionPort;

    @Mock
    private CreditPort creditPort;

    @Mock
    private UserPort userPort;

    @Mock
    private LanguageVariantPort languageVariantPort;

    private CorrectionRequestService service;

    @BeforeEach
    void setUp() {
        service = new CorrectionRequestService(
                correctionRequestPort,
                correctionPort,
                creditPort,
                userPort,
                languageVariantPort,
                new ToneBridgeProperties()
        );
    }

    @Test
    void requesterCanDeletePendingRequestWithoutCorrections() {
        UUID requestId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();

        when(correctionRequestPort.findById(requestId))
                .thenReturn(Optional.of(request(requestId, requesterId, RequestStatus.PENDING)));
        when(correctionPort.existsByRequestId(requestId)).thenReturn(false);

        service.delete(requestId, requesterId);

        verify(correctionRequestPort).softDelete(requestId);
    }

    @Test
    void cannotDeleteCompletedRequest() {
        UUID requestId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();

        when(correctionRequestPort.findById(requestId))
                .thenReturn(Optional.of(request(requestId, requesterId, RequestStatus.COMPLETED)));

        assertThatThrownBy(() -> service.delete(requestId, requesterId))
                .isInstanceOf(ToneBridgeException.class)
                .extracting(e -> ((ToneBridgeException) e).getErrorCode())
                .isEqualTo(ErrorCode.REQUEST_ALREADY_COMPLETED);
        verify(correctionRequestPort, never()).softDelete(requestId);
    }

    @Test
    void cannotDeletePendingRequestWithExistingCorrection() {
        UUID requestId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();

        when(correctionRequestPort.findById(requestId))
                .thenReturn(Optional.of(request(requestId, requesterId, RequestStatus.PENDING)));
        when(correctionPort.existsByRequestId(requestId)).thenReturn(true);

        assertThatThrownBy(() -> service.delete(requestId, requesterId))
                .isInstanceOf(ToneBridgeException.class)
                .extracting(e -> ((ToneBridgeException) e).getErrorCode())
                .isEqualTo(ErrorCode.REQUEST_ALREADY_COMPLETED);
        verify(correctionRequestPort, never()).softDelete(requestId);
    }

    @Test
    void nonOwnerCannotDeleteRequest() {
        UUID requestId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        UUID attackerId = UUID.randomUUID();

        when(correctionRequestPort.findById(requestId))
                .thenReturn(Optional.of(request(requestId, requesterId, RequestStatus.PENDING)));

        assertThatThrownBy(() -> service.delete(requestId, attackerId))
                .isInstanceOf(ToneBridgeException.class)
                .extracting(e -> ((ToneBridgeException) e).getErrorCode())
                .isEqualTo(ErrorCode.UNAUTHORIZED);
        verify(correctionRequestPort, never()).softDelete(requestId);
    }

    private CorrectionRequest request(UUID requestId, UUID requesterId, RequestStatus status) {
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
                1,
                status,
                null,
                now,
                now.plusSeconds(3600),
                null
        );
    }
}
