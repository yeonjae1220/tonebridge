package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class AiFallbackScheduler {

    private final AiFallbackService aiFallbackService;

    @Scheduled(fixedDelayString = "${tonebridge.correction.fallback-scheduler-interval-ms:3600000}")
    public void run() {
        log.debug("AiFallbackScheduler triggered");
        aiFallbackService.processFallbacks();
    }
}
