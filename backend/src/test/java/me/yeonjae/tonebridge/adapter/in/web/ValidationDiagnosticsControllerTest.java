package me.yeonjae.tonebridge.adapter.in.web;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import me.yeonjae.tonebridge.adapter.out.persistence.ValidationDiagnosticRecorder;
import me.yeonjae.tonebridge.shared.event.ValidationDiagnostic;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.transaction.CannotCreateTransactionException;
import org.springframework.dao.DataAccessResourceFailureException;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class ValidationDiagnosticsControllerTest {
    @ParameterizedTest
    @ValueSource(booleans = {false,true})
    void failedPersistenceNeverReportsSuccessOrIncrementsMemoryCounter(boolean beginFails) {
        var recorder=mock(ValidationDiagnosticRecorder.class);
        var registry=new SimpleMeterRegistry();
        UUID user=UUID.randomUUID();
        when(recorder.record(user,ValidationDiagnostic.UPLOAD_FAILED))
                .thenThrow(beginFails ? new CannotCreateTransactionException("fixture cannot begin transaction")
                        : new DataAccessResourceFailureException("fixture DB offline"));
        var response=new ValidationDiagnosticsController(registry,recorder)
                .record(user,new ValidationDiagnosticsController.Request(ValidationDiagnostic.UPLOAD_FAILED));
        assertThat(response.getStatusCode().value()).isEqualTo(503);
        assertThat(registry.find("tonebridge.validation.client").counter()).isNull();
    }
}
