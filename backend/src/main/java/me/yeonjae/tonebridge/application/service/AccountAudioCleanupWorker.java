package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Deletes recordings left behind by deleted accounts; see {@link AccountAudioPurge}. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "tonebridge.account-audio.scheduler-enabled", havingValue = "true", matchIfMissing = true)
public class AccountAudioCleanupWorker {
    private final AccountAudioPurge purge;

    @Scheduled(fixedDelay = 60_000, initialDelay = 60_000)
    public void clean() {
        purge.deleteQueued();
    }
}
