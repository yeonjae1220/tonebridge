package me.yeonjae.tonebridge.application.service;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name="tonebridge.cloud-audio.scheduler-enabled",havingValue="true",matchIfMissing=true)
public class CloudAudioCleanupWorker {
    private final CloudAudioFiles files;
    @Scheduled(fixedDelay=60000,initialDelay=60000) public void clean(){files.cleanup();}
}
