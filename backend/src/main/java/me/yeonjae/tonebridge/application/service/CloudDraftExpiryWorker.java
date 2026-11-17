package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class CloudDraftExpiryWorker {
    private final CloudDraftService drafts;
    @Value("${tonebridge.cloud-drafts.scheduler-enabled:true}") private boolean enabled;
    @Scheduled(initialDelay=60000,fixedDelay=60000)
    public void clean() {
        if(!enabled)return;
        for(var owner:drafts.expiredOwners()) drafts.cleanOwner(owner);
    }
}
