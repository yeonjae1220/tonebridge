package me.yeonjae.tonebridge.adapter.in.web;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.adapter.out.sse.SseEmitterRegistry;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.UUID;

@RestController
@RequestMapping("/api/sse")
@RequiredArgsConstructor
public class SseController {

    private final SseEmitterRegistry registry;

    @GetMapping("/notifications")
    public SseEmitter notifications(@AuthenticationPrincipal UUID userId) {
        return registry.connect(userId);
    }
}
