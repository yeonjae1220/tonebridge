package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.adapter.in.web.dto.CardNativeAudioResponse;
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
    private final GetNativeAudioDownloadUrlUseCase getNativeAudioDownloadUrlUseCase;
    private final SubmitLearnerAttemptUseCase submitAttemptUseCase;
    private final AddCorrectionNoteUseCase addNoteUseCase;
    private final AddCardNativeAudioUseCase addNativeAudioUseCase;
    private final GetCardNativeAudiosUseCase getNativeAudiosUseCase;
    private final DeleteCardNativeAudioUseCase deleteNativeAudioUseCase;
    private final UpdateCardNoteUseCase updateCardNoteUseCase;
    private final UpdateNativeAudioNoteUseCase updateNativeAudioNoteUseCase;

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

    @GetMapping("/cards/{cardId}/native-audio")
    public ResponseEntity<Map<String, String>> getNativeAudioDownloadUrl(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID cardId) {
        String downloadUrl = getNativeAudioDownloadUrlUseCase.getDownloadUrl(cardId, userId);
        return ResponseEntity.ok(Map.of("downloadUrl", downloadUrl));
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

    // ─── Card Native Audio (multiple recordings) ───────────────────────────

    @PostMapping("/cards/{cardId}/native-audios/upload-url")
    public ResponseEntity<Map<String, String>> getNativeAudioUploadUrlV2(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID cardId,
            @Valid @RequestBody UploadUrlDto dto) {
        var result = addNativeAudioUseCase.getUploadUrl(
                new AddCardNativeAudioUseCase.GetUrlCommand(cardId, userId, dto.fileName()));
        return ResponseEntity.ok(Map.of("uploadUrl", result.uploadUrl(), "audioKey", result.audioKey()));
    }

    @PostMapping("/cards/{cardId}/native-audios")
    public ResponseEntity<CardNativeAudioResponse> confirmNativeAudioV2(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID cardId,
            @Valid @RequestBody ConfirmAudioDto dto) {
        var audio = addNativeAudioUseCase.confirm(
                new AddCardNativeAudioUseCase.ConfirmCommand(cardId, userId, dto.audioKey()));
        return ResponseEntity.status(HttpStatus.CREATED).body(CardNativeAudioResponse.from(audio));
    }

    @GetMapping("/cards/{cardId}/native-audios")
    public ResponseEntity<List<CardNativeAudioResponse>> getNativeAudios(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID cardId) {
        var audios = getNativeAudiosUseCase.getAudios(cardId, userId);
        return ResponseEntity.ok(audios.stream().map(CardNativeAudioResponse::from).toList());
    }

    @GetMapping("/native-audios/{audioId}/download-url")
    public ResponseEntity<Map<String, String>> getNativeAudioDownloadUrlV2(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID audioId) {
        String url = getNativeAudiosUseCase.getDownloadUrl(audioId, userId);
        return ResponseEntity.ok(Map.of("downloadUrl", url));
    }

    @DeleteMapping("/cards/{cardId}/native-audios/{audioId}")
    public ResponseEntity<Void> deleteNativeAudio(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID cardId,
            @PathVariable UUID audioId) {
        deleteNativeAudioUseCase.delete(audioId, cardId, userId);
        return ResponseEntity.noContent().build();
    }

    // ─── Note endpoints ────────────────────────────────────────────────────

    @PatchMapping("/cards/{cardId}/note")
    public ResponseEntity<StudyCardResponse> updateCardNote(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID cardId,
            @Valid @RequestBody NoteDto dto) {
        var card = updateCardNoteUseCase.updateNote(cardId, userId, dto.note());
        return ResponseEntity.ok(StudyCardResponse.from(card));
    }

    @PatchMapping("/native-audios/{audioId}/note")
    public ResponseEntity<CardNativeAudioResponse> updateNativeAudioNote(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID audioId,
            @Valid @RequestBody NoteDto dto) {
        var audio = updateNativeAudioNoteUseCase.updateNote(audioId, userId, dto.note());
        return ResponseEntity.ok(CardNativeAudioResponse.from(audio));
    }

    record CreateCardDto(@NotBlank String phrase, String context, List<String> tags) {}
    record UploadUrlDto(@NotBlank String fileName) {}
    record ConfirmAudioDto(@NotBlank String audioKey) {}
    record SubmitAttemptDto(@NotBlank String audioKey) {}
    record CorrectionNoteDto(@NotBlank String correctionNote, @Min(1) @Max(5) Integer score) {}
    record NoteDto(String note) {}
}
