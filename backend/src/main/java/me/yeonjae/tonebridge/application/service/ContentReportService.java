package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Lets a user report another user or a piece of their content (App Store guideline 1.2).
 *
 * <p>The reported user is always resolved here from the target, and a target is only reportable
 * by someone who can see it, so a report can never be pinned on an arbitrary account.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class ContentReportService {

    public enum TargetType { USER, CARD, NATIVE_AUDIO, ATTEMPT_FEEDBACK, CORRECTION_REQUEST, CORRECTION }

    public enum Reason { SPAM, HARASSMENT, HATE, SEXUAL, VIOLENCE, ILLEGAL, OTHER }

    public record Command(UUID reporter, TargetType type, UUID targetId, Reason reason, String detail, boolean alsoBlock) {}

    /** Published after a new report commits; the operator alert listens for it. */
    public record ReportCreated(UUID reportId, TargetType type, Reason reason) {}

    static final int DAILY_LIMIT = 20;
    static final int MAX_DETAIL = 500;

    // Each query returns the reported user (nullable for AI corrections or legacy example voices)
    // only when the target exists and the reporter can see it.
    private static final String MEMBER = " EXISTS (SELECT 1 FROM session_members m WHERE m.session_id = c.session_id AND m.user_id = ?)";

    private final JdbcTemplate jdbc;
    private final UserBlockService blocks;
    private final ApplicationEventPublisher events;

    public UUID report(Command command) {
        String detail = normalizeDetail(command.detail());
        // Serialise one reporter's reports so the daily limit holds under concurrent requests.
        jdbc.queryForList("SELECT id FROM users WHERE id = ? FOR UPDATE", UUID.class, command.reporter());

        Optional<UUID> reported = resolve(command.type(), command.targetId(), command.reporter())
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.REPORT_TARGET_NOT_FOUND));
        if (reported.filter(command.reporter()::equals).isPresent()) {
            throw new ToneBridgeException(ErrorCode.REPORT_OWN_CONTENT);
        }

        UUID id = existingOpen(command).orElseGet(() -> create(command, reported.orElse(null), detail));
        if (command.alsoBlock()) reported.ifPresent(user -> blocks.block(command.reporter(), user));
        return id;
    }

    private UUID create(Command command, UUID reportedUser, String detail) {
        Integer recent = jdbc.queryForObject(
                "SELECT count(*) FROM content_reports WHERE reporter_id = ? AND created_at > now() - interval '1 day'",
                Integer.class, command.reporter());
        if (recent != null && recent >= DAILY_LIMIT) throw new ToneBridgeException(ErrorCode.REPORT_LIMIT);
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO content_reports(id, reporter_id, target_type, target_id, reported_user_id, reason, detail)
                VALUES (?, ?, ?, ?, ?, ?, ?)""",
                id, command.reporter(), command.type().name(), command.targetId(), reportedUser,
                command.reason().name(), detail);
        events.publishEvent(new ReportCreated(id, command.type(), command.reason()));
        return id;
    }

    private static String normalizeDetail(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String detail = raw.strip();
        if (detail.length() > MAX_DETAIL) throw new ToneBridgeException(ErrorCode.INVALID_INPUT);
        return detail;
    }

    private Optional<UUID> existingOpen(Command command) {
        return jdbc.queryForList("""
                SELECT id FROM content_reports
                WHERE reporter_id = ? AND target_type = ? AND target_id = ? AND status = 'OPEN'""",
                UUID.class, command.reporter(), command.type().name(), command.targetId()).stream().findFirst();
    }

    /** Outer Optional: target visible to the reporter. Inner Optional: the user behind it, if any. */
    private Optional<Optional<UUID>> resolve(TargetType type, UUID target, UUID reporter) {
        List<UUID> rows = switch (type) {
            case USER -> jdbc.queryForList("SELECT id FROM users WHERE id = ?", UUID.class, target);
            case CARD -> jdbc.queryForList(
                    "SELECT c.created_by_user_id FROM study_cards c WHERE c.id = ? AND c.deleted_at IS NULL AND " + MEMBER,
                    UUID.class, target, reporter);
            case NATIVE_AUDIO -> jdbc.queryForList("""
                    SELECT o.owner_id FROM card_native_audio a
                    JOIN study_cards c ON c.id = a.card_id
                    LEFT JOIN audio_upload_owners o ON o.audio_key = a.audio_key
                    WHERE a.id = ? AND c.deleted_at IS NULL AND """ + MEMBER, UUID.class, target, reporter);
            case ATTEMPT_FEEDBACK -> jdbc.queryForList("""
                    SELECT t.correction_author_id FROM learner_attempts t
                    JOIN study_cards c ON c.id = t.card_id
                    WHERE t.id = ? AND t.correction_note IS NOT NULL AND t.deleted_at IS NULL AND """ + MEMBER,
                    UUID.class, target, reporter);
            case CORRECTION_REQUEST -> jdbc.queryForList(
                    "SELECT requester_id FROM correction_requests WHERE id = ? AND deleted_at IS NULL", UUID.class, target);
            case CORRECTION -> jdbc.queryForList(
                    "SELECT corrector_id FROM corrections WHERE id = ? AND deleted_at IS NULL", UUID.class, target);
        };
        if (rows.isEmpty()) return Optional.empty();
        return Optional.of(Optional.ofNullable(rows.get(0)));
    }
}
