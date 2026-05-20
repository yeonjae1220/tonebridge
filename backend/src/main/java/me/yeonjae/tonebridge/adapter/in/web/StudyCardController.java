package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.adapter.in.web.dto.LearnerAttemptResponse;
import me.yeonjae.tonebridge.adapter.in.web.dto.StudyCardResponse;
import me.yeonjae.tonebridge.application.port.in.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@Validated
@RequiredArgsConstructor
public class StudyCardController {

    private final GetStudyCardUseCase getCardUseCase;
    private final CreateStudyCardUseCase createCardUseCase;
    private final UploadNativeAudioUseCase uploadNativeAudioUseCase;
    private final SubmitLearnerAttemptUseCase submitAttemptUseCase;
    private final AddCorrectionNoteUseCase addNoteUseCase;

    @PostMapping("/sessions/{sessionId}/cards")
    public ResponseEntity<StudyCardResponse> createCard(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID sessionId,
            @Valid @RequestBody CreateCardDto dto) {
        var card = createCardUseCase.create(
                new CreateStudyCardUseCase.Command(sessionId, userId, dto.phrase(), dto.context(), dto.tags()));
        return ResponseEntity.status(HttpStatus.CREATED).body(StudyCardResponse.from(card));
    }

    @GetMapping("/cards/{cardId}")
    public ResponseEntity<StudyCardResponse> getCard(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID cardId) {
        var card = getCardUseCase.getCard(cardId, userId);
        return ResponseEntity.ok(StudyCardResponse.from(card));
    }

    @PostMapping("/cards/{cardId}/native-audio")
    public ResponseEntity<Map<String, String>> getNativeAudioUploadUrl(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID cardId,
            @Valid @RequestBody UploadUrlDto dto) {
        var result = uploadNativeAudioUseCase.getUploadUrl(
                new UploadNativeAudioUseCase.GetUrlCommand(cardId, userId, dto.fileName()));
        return ResponseEntity.ok(Map.of("uploadUrl", result.uploadUrl(), "audioKey", result.audioKey()));
    }

    @PatchMapping("/cards/{cardId}/native-audio")
    public ResponseEntity<StudyCardResponse> confirmNativeAudio(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID cardId,
            @Valid @RequestBody ConfirmAudioDto dto) {
        var card = uploadNativeAudioUseCase.upload(
                new UploadNativeAudioUseCase.Command(cardId, userId, dto.audioKey()));
        return ResponseEntity.ok(StudyCardResponse.from(card));
    }

    @PostMapping("/cards/{cardId}/attempts")
    public ResponseEntity<LearnerAttemptResponse> submitAttempt(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID cardId,
            @Valid @RequestBody SubmitAttemptDto dto) {
        var attempt = submitAttemptUseCase.submit(
                new SubmitLearnerAttemptUseCase.Command(cardId, userId, dto.audioKey()));
        return ResponseEntity.status(HttpStatus.CREATED).body(LearnerAttemptResponse.from(attempt));
    }

    @GetMapping("/cards/{cardId}/attempts")
    public ResponseEntity<List<LearnerAttemptResponse>> getAttempts(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID cardId) {
        var attempts = getCardUseCase.getAttempts(cardId, userId);
        return ResponseEntity.ok(attempts.stream().map(LearnerAttemptResponse::from).toList());
    }

    @PatchMapping("/attempts/{attemptId}/correction")
    public ResponseEntity<LearnerAttemptResponse> addCorrection(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID attemptId,
            @Valid @RequestBody CorrectionNoteDto dto) {
        var attempt = addNoteUseCase.addNote(
                new AddCorrectionNoteUseCase.Command(attemptId, userId, dto.correctionNote(), dto.score()));
        return ResponseEntity.ok(LearnerAttemptResponse.from(attempt));
    }

    record CreateCardDto(@NotBlank String phrase, String context, List<String> tags) {}
    record UploadUrlDto(@NotBlank String fileName) {}
    record ConfirmAudioDto(@NotBlank String audioKey) {}
    record SubmitAttemptDto(@NotBlank String audioKey) {}
    record CorrectionNoteDto(@NotBlank String correctionNote, Integer score) {}
}
