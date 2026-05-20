package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.adapter.in.web.dto.StudyCardResponse;
import me.yeonjae.tonebridge.adapter.in.web.dto.StudySessionResponse;
import me.yeonjae.tonebridge.application.port.in.CreateStudySessionUseCase;
import me.yeonjae.tonebridge.application.port.in.EndStudySessionUseCase;
import me.yeonjae.tonebridge.application.port.in.GetStudyCardUseCase;
import me.yeonjae.tonebridge.application.port.in.GetStudySessionsUseCase;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/sessions")
@Validated
@RequiredArgsConstructor
public class StudySessionController {

    private final CreateStudySessionUseCase createUseCase;
    private final GetStudySessionsUseCase getUseCase;
    private final EndStudySessionUseCase endUseCase;
    private final GetStudyCardUseCase getCardUseCase;

    @PostMapping
    public ResponseEntity<StudySessionResponse> create(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody CreateSessionDto dto) {
        var session = createUseCase.create(
                new CreateStudySessionUseCase.Command(userId, dto.friendId(), dto.title()));
        return ResponseEntity.status(HttpStatus.CREATED).body(StudySessionResponse.from(session));
    }

    @GetMapping
    public ResponseEntity<List<StudySessionResponse>> getMySessions(@AuthenticationPrincipal UUID userId) {
        var sessions = getUseCase.getSessions(userId);
        return ResponseEntity.ok(sessions.stream().map(StudySessionResponse::from).toList());
    }

    @GetMapping("/{sessionId}")
    public ResponseEntity<StudySessionResponse> getSession(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID sessionId) {
        var session = getUseCase.getSession(sessionId, userId);
        return ResponseEntity.ok(StudySessionResponse.from(session));
    }

    @PatchMapping("/{sessionId}/end")
    public ResponseEntity<StudySessionResponse> endSession(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID sessionId) {
        var session = endUseCase.end(sessionId, userId);
        return ResponseEntity.ok(StudySessionResponse.from(session));
    }

    @GetMapping("/{sessionId}/cards")
    public ResponseEntity<List<StudyCardResponse>> getCards(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID sessionId) {
        var cards = getCardUseCase.getCards(sessionId, userId);
        return ResponseEntity.ok(cards.stream().map(StudyCardResponse::from).toList());
    }

    record CreateSessionDto(@NotNull UUID friendId, String title) {}
}
