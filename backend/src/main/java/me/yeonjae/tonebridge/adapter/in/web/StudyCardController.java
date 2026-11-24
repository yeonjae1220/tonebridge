package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.adapter.in.web.dto.CardNativeAudioResponse;
import me.yeonjae.tonebridge.adapter.in.web.dto.LearnerAttemptResponse;
import me.yeonjae.tonebridge.adapter.in.web.dto.StudyCardResponse;
import me.yeonjae.tonebridge.application.port.in.*;
import me.yeonjae.tonebridge.domain.studycard.StudyCard;
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
    private final me.yeonjae.tonebridge.application.service.SubmissionService submissions;
    private final UploadNativeAudioUseCase uploadNativeAudioUseCase;
    private final GetNativeAudioDownloadUrlUseCase getNativeAudioDownloadUrlUseCase;
    private final SubmitLearnerAttemptUseCase submitAttemptUseCase;
    private final GetLearnerAttemptAudioUseCase getAttemptAudioUseCase;
    private final AddCorrectionNoteUseCase addNoteUseCase;
    private final AddCardNativeAudioUseCase addNativeAudioUseCase;
    private final GetCardNativeAudiosUseCase getNativeAudiosUseCase;
    private final DeleteCardNativeAudioUseCase deleteNativeAudioUseCase;
    private final UpdateCardNoteUseCase updateCardNoteUseCase;
    private final UpdateNativeAudioNoteUseCase updateNativeAudioNoteUseCase;
    private final UpdateStudyCardUseCase updateCardUseCase;
    private final MoveStudyCardUseCase moveCardUseCase;
    private final DeleteStudyCardUseCase deleteCardUseCase;

    @PostMapping("/sessions/{sessionId}/cards")
    public ResponseEntity<StudyCardResponse> createCard(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID sessionId,
            @RequestHeader(value = "Idempotency-Key", required = false) UUID operation,
            @Valid @RequestBody CreateCardDto dto) {
        var card = submissions.create(operation,
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

    @PatchMapping("/cards/{cardId}")
    public ResponseEntity<StudyCardResponse> updateCard(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID cardId,
            @Valid @RequestBody UpdateCardDto dto) {
        var card = updateCardUseCase.update(
                new UpdateStudyCardUseCase.Command(cardId, userId, dto.phrase(), dto.context(), dto.tags()));
        return ResponseEntity.ok(StudyCardResponse.from(card));
    }

    @PatchMapping("/cards/{cardId}/move")
    public ResponseEntity<StudyCardResponse> moveCard(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID cardId,
            @Valid @RequestBody MoveCardDto dto) {
        var card = moveCardUseCase.move(
                new MoveStudyCardUseCase.Command(cardId, userId, dto.targetSessionId(), dto.position()));
        return ResponseEntity.ok(StudyCardResponse.from(card));
    }

    @DeleteMapping("/cards/{cardId}")
    public ResponseEntity<Void> deleteCard(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID cardId) {
        deleteCardUseCase.delete(cardId, userId);
        return ResponseEntity.noContent().build();
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
            @RequestHeader(value="Idempotency-Key",required=false) UUID operation,
            @Valid @RequestBody SubmitAttemptDto dto) {
        var attempt = submissions.attempt(operation,
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

    @GetMapping("/attempts/{attemptId}/download-url")
    public ResponseEntity<Map<String, String>> getAttemptDownloadUrl(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID attemptId) {
        return ResponseEntity.ok()
                .cacheControl(org.springframework.http.CacheControl.noStore())
                .body(Map.of("downloadUrl", getAttemptAudioUseCase.getAttemptDownloadUrl(attemptId, userId)));
    }

    @PatchMapping("/attempts/{attemptId}/correction")
    public ResponseEntity<LearnerAttemptResponse> addCorrection(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID attemptId,
            @Valid @RequestBody CorrectionNoteDto dto) {
        var attempt = addNoteUseCase.addNote(
                new AddCorrectionNoteUseCase.Command(attemptId, userId, dto.correctionNote(), dto.score(),
                        dto.soundTargets() == null ? null : dto.soundTargets().stream().map(SoundTargetDto::guideId).toList()));
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
            @RequestHeader(value="Idempotency-Key",required=false) UUID operation,
            @Valid @RequestBody ConfirmAudioDto dto) {
        var audio = submissions.example(operation,
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

    /**
     * Tags are stored comma-joined in one VARCHAR(500) column: 20 tags of 24 characters plus 19
     * separators is 499. A comma inside a tag would split it into two on the way back out.
     * The web client mirrors these limits in frontend/src/lib/cardTags.ts.
     */
    static final int MAX_TAGS = 20;
    static final int MAX_TAG_LENGTH = 24;

    record CreateCardDto(@NotBlank @Size(max = StudyCard.MAX_PHRASE_LENGTH) String phrase, String context,
                         @Size(max = MAX_TAGS) List<@NotBlank @Size(max = MAX_TAG_LENGTH) @Pattern(regexp = "[^,]*") String> tags) {}
    record UpdateCardDto(@NotBlank @Size(max = StudyCard.MAX_PHRASE_LENGTH) String phrase, String context,
                         @Size(max = MAX_TAGS) List<@NotBlank @Size(max = MAX_TAG_LENGTH) @Pattern(regexp = "[^,]*") String> tags) {}
    record MoveCardDto(@NotNull UUID targetSessionId, @Min(0) int position) {}
    record UploadUrlDto(@NotBlank String fileName) {}
    record ConfirmAudioDto(@NotBlank String audioKey) {}
    record SubmitAttemptDto(@NotBlank String audioKey) {}
    /** {@code soundTargets} omitted keeps the stored sounds; an empty list clears them. Ids are checked against the catalogue. */
    record CorrectionNoteDto(@NotBlank String correctionNote, @Min(1) @Max(5) Integer score,
                             @Size(max = 3) List<@NotNull @Valid SoundTargetDto> soundTargets) {}
    record SoundTargetDto(@NotBlank @Size(max = 40) String guideId) {}
    record NoteDto(String note) {}
}
