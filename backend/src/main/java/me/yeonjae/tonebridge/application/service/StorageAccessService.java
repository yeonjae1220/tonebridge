package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.in.ValidateAudioKeyAccessUseCase;
import me.yeonjae.tonebridge.application.port.out.CorrectionPort;
import me.yeonjae.tonebridge.application.port.out.CorrectionRequestPort;
import me.yeonjae.tonebridge.domain.correction.CorrectionRequest;
import me.yeonjae.tonebridge.domain.correction.RequestStatus;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;
import java.util.regex.Pattern;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class StorageAccessService implements ValidateAudioKeyAccessUseCase {

    private static final Pattern AUDIO_KEY_PATTERN = Pattern.compile(
            "^audio/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-zA-Z0-9._-]+$"
    );

    private final CorrectionRequestPort correctionRequestPort;
    private final CorrectionPort correctionPort;

    @Override
    public void validate(UUID userId, String audioKey) {
        if (!AUDIO_KEY_PATTERN.matcher(audioKey).matches()) {
            throw new ToneBridgeException(ErrorCode.INVALID_AUDIO_KEY);
        }

        // Check if key is the original request audio
        var requestOpt = correctionRequestPort.findByAudioUrl(audioKey);
        if (requestOpt.isPresent()) {
            CorrectionRequest request = requestOpt.get();
            if (request.requesterId().equals(userId)) return;
            // PENDING requests are visible to all potential correctors via the feed
            if (request.status() == RequestStatus.PENDING) return;
            boolean isCorrector = correctionPort.findByRequestId(request.id())
                    .stream().anyMatch(c -> c.correctorId().equals(userId));
            if (isCorrector) return;
            throw new ToneBridgeException(ErrorCode.STORAGE_ACCESS_DENIED);
        }

        // Check if key is a corrector's reference re-recording
        var correctionOpt = correctionPort.findByReferenceAudioUrl(audioKey);
        if (correctionOpt.isPresent()) {
            var correction = correctionOpt.get();
            if (correction.correctorId().equals(userId)) return;
            correctionRequestPort.findById(correction.requestId())
                    .filter(r -> r.requesterId().equals(userId))
                    .orElseThrow(() -> new ToneBridgeException(ErrorCode.STORAGE_ACCESS_DENIED));
            return;
        }

        throw new ToneBridgeException(ErrorCode.FILE_NOT_FOUND);
    }
}
