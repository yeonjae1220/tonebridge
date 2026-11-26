package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.yeonjae.tonebridge.application.port.in.DeleteCurrentUserUseCase;
import me.yeonjae.tonebridge.application.port.out.StoragePort;
import me.yeonjae.tonebridge.application.service.ContentReportService.TargetType;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Operator review of open reports: see what was reported, then dismiss it, remove it, or remove the account. */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class AdminReportService {

    public record OpenReport(UUID id, TargetType type, String reason, String detail, OffsetDateTime createdAt,
                             String reporter, UUID reportedUserId, String reportedUser, int reportsAgainstUser,
                             String content, String audioUrl) {
        public boolean canRemoveContent() { return type != TargetType.USER; }
    }

    private static final int PAGE = 100;

    private final JdbcTemplate jdbc;
    private final StoragePort storage;
    private final DeleteCurrentUserUseCase accounts;

    @Transactional(readOnly = true)
    public List<OpenReport> open() {
        return jdbc.query("""
                SELECT r.id, r.target_type, r.target_id, r.reason, r.detail, r.created_at, r.reported_user_id,
                       rep.username AS reporter, sub.username AS reported,
                       (SELECT count(*) FROM content_reports o WHERE o.status = 'OPEN'
                            AND o.reported_user_id = r.reported_user_id) AS against
                FROM content_reports r
                LEFT JOIN users rep ON rep.id = r.reporter_id
                LEFT JOIN users sub ON sub.id = r.reported_user_id
                WHERE r.status = 'OPEN' ORDER BY r.created_at LIMIT ?""", (rs, i) -> {
            TargetType type = TargetType.valueOf(rs.getString("target_type"));
            UUID target = rs.getObject("target_id", UUID.class);
            UUID reportedUser = rs.getObject("reported_user_id", UUID.class);
            return new OpenReport(rs.getObject("id", UUID.class), type, rs.getString("reason"), rs.getString("detail"),
                    rs.getObject("created_at", OffsetDateTime.class), rs.getString("reporter"), reportedUser,
                    rs.getString("reported"), reportedUser == null ? 0 : rs.getInt("against"),
                    content(type, target), audioUrl(type, target));
        }, PAGE);
    }

    public void dismiss(UUID reportId) {
        resolve(requireOpen(reportId), "DISMISSED", "DISMISSED");
    }

    public void removeContent(UUID reportId) {
        Report report = requireOpen(reportId);
        switch (report.type()) {
            case USER -> throw new ToneBridgeException(ErrorCode.INVALID_INPUT);
            case CARD -> jdbc.update("UPDATE study_cards SET deleted_at = now() WHERE id = ?", report.target());
            case NATIVE_AUDIO -> removeNativeAudio(report.target());
            case ATTEMPT_FEEDBACK -> {
                jdbc.update("""
                        UPDATE learner_attempts SET correction_note = NULL, score = NULL,
                               correction_author_id = NULL, correction_updated_at = NULL WHERE id = ?""", report.target());
                jdbc.update("DELETE FROM attempt_sound_targets WHERE attempt_id = ?", report.target());
            }
            case CORRECTION_REQUEST -> jdbc.update("UPDATE correction_requests SET deleted_at = now() WHERE id = ?", report.target());
            case CORRECTION -> jdbc.update("UPDATE corrections SET deleted_at = now() WHERE id = ?", report.target());
        }
        // Every open report on the same target is settled by the same removal.
        jdbc.update("""
                UPDATE content_reports SET status = 'ACTIONED', resolution = 'CONTENT_REMOVED', resolved_at = now()
                WHERE status = 'OPEN' AND target_type = ? AND target_id = ?""", report.type().name(), report.target());
    }

    public void deleteAccount(UUID reportId) {
        Report report = requireOpen(reportId);
        if (report.reportedUser() == null) throw new ToneBridgeException(ErrorCode.INVALID_INPUT);
        // Settle first: the reported_user_id link is cleared when the account goes.
        jdbc.update("""
                UPDATE content_reports SET status = 'ACTIONED', resolution = 'ACCOUNT_DELETED', resolved_at = now()
                WHERE status = 'OPEN' AND reported_user_id = ?""", report.reportedUser());
        accounts.delete(report.reportedUser());
    }

    private void removeNativeAudio(UUID audioId) {
        List<String> keys = jdbc.queryForList("DELETE FROM card_native_audio WHERE id = ? RETURNING audio_key", String.class, audioId);
        if (keys.isEmpty()) return;
        String key = keys.get(0);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                try {
                    storage.deleteObject(key);
                } catch (RuntimeException e) {
                    log.error("Removed reported example voice {} but could not delete its file", audioId, e);
                }
            }
        });
    }

    private record Report(UUID id, TargetType type, UUID target, UUID reportedUser) {}

    private Report requireOpen(UUID reportId) {
        return jdbc.query("SELECT id, target_type, target_id, reported_user_id FROM content_reports WHERE id = ? AND status = 'OPEN' FOR UPDATE",
                        (rs, i) -> new Report(rs.getObject("id", UUID.class), TargetType.valueOf(rs.getString("target_type")),
                                rs.getObject("target_id", UUID.class), rs.getObject("reported_user_id", UUID.class)), reportId)
                .stream().findFirst()
                .orElseThrow(() -> new ToneBridgeException(ErrorCode.REPORT_TARGET_NOT_FOUND));
    }

    private void resolve(Report report, String status, String resolution) {
        jdbc.update("UPDATE content_reports SET status = ?, resolution = ?, resolved_at = now() WHERE id = ?",
                status, resolution, report.id());
    }

    /** What the reported thing says, so the operator can judge it without opening the app. */
    private String content(TargetType type, UUID target) {
        String sql = switch (type) {
            case USER -> "SELECT '사용자 ' || username FROM users WHERE id = ?";
            case CARD -> "SELECT phrase || coalesce(' / ' || context, '') || coalesce(' / ' || explanation, '') FROM study_cards WHERE id = ?";
            case NATIVE_AUDIO -> "SELECT '예시 음성 · 카드: ' || c.phrase || coalesce(' / 메모: ' || a.note, '') FROM card_native_audio a JOIN study_cards c ON c.id = a.card_id WHERE a.id = ?";
            case ATTEMPT_FEEDBACK -> "SELECT correction_note FROM learner_attempts WHERE id = ?";
            case CORRECTION_REQUEST -> "SELECT coalesce(content_text, '(음성 요청)') || coalesce(' / ' || context, '') FROM correction_requests WHERE id = ?";
            case CORRECTION -> "SELECT corrected_text || coalesce(' / ' || explanation, '') FROM corrections WHERE id = ?";
        };
        return jdbc.queryForList(sql, String.class, target).stream().findFirst().orElse("(이미 삭제됨)");
    }

    private String audioUrl(TargetType type, UUID target) {
        String sql = switch (type) {
            case NATIVE_AUDIO -> "SELECT audio_key FROM card_native_audio WHERE id = ?";
            case CORRECTION_REQUEST -> "SELECT audio_url FROM correction_requests WHERE id = ?";
            default -> null;
        };
        if (sql == null) return null;
        return jdbc.queryForList(sql, String.class, target).stream().findFirst()
                .filter(key -> key != null && key.startsWith("audio/"))
                .map(key -> storage.generatePresignedDownloadUrl(key, Duration.ofMinutes(15)))
                .orElse(null);
    }
}
