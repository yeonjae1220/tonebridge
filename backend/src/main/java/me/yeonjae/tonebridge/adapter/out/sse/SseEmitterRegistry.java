package me.yeonjae.tonebridge.adapter.out.sse;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import java.io.IOException;
import java.util.UUID;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j @Component
public class SseEmitterRegistry {
    // Retain every connection, so credential reset closes all devices, not just the latest one.
    private final ConcurrentHashMap<UUID, Set<SseEmitter>> emitters = new ConcurrentHashMap<>();
    public SseEmitter connect(UUID userId) {
        SseEmitter emitter = new SseEmitter(30_000L);
        emitters.compute(userId,(id,current) -> {
            Set<SseEmitter> active=current==null ? ConcurrentHashMap.newKeySet() : current;
            active.add(emitter);return active;
        });
        emitter.onCompletion(() -> remove(userId,emitter));
        emitter.onTimeout(() -> remove(userId,emitter));
        emitter.onError(e -> remove(userId,emitter));
        return emitter;
    }
    private void remove(UUID userId,SseEmitter emitter) {
        emitters.computeIfPresent(userId,(id,active)->{active.remove(emitter);return active.isEmpty()?null:active;});
    }
    @org.springframework.transaction.event.TransactionalEventListener
    public void credentialsReset(me.yeonjae.tonebridge.shared.event.CredentialsReset event) {
        Set<SseEmitter> active=emitters.remove(event.userId());
        if(active!=null) active.forEach(SseEmitter::complete);
    }
    public void send(UUID userId,String event,Object data) {
        Set<SseEmitter> active=emitters.get(userId);
        if(active==null) return;
        for(SseEmitter emitter:active) {
            try {emitter.send(SseEmitter.event().name(event).data(data));}
            catch(IOException | IllegalStateException e) {remove(userId,emitter);}
        }
    }
}
