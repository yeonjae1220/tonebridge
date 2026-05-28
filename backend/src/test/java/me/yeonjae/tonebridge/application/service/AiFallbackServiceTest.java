package me.yeonjae.tonebridge.application.service;

import me.yeonjae.tonebridge.application.port.out.CorrectionRequestPort;
import me.yeonjae.tonebridge.shared.config.ToneBridgeProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AiFallbackServiceTest {

    @Mock
    private CorrectionRequestPort correctionRequestPort;

    @Mock
    private AiFallbackProcessor processor;

    @Test
    void skipsFallbackProcessingWhenAiIsDisabled() {
        ToneBridgeProperties properties = new ToneBridgeProperties();
        properties.getAi().setEnabled(false);
        AiFallbackService service = new AiFallbackService(properties, correctionRequestPort, processor);

        service.processFallbacks();

        verify(correctionRequestPort, never()).findPendingOlderThan(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyInt()
        );
    }
}
