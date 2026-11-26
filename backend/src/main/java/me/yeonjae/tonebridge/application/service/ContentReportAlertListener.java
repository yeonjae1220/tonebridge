package me.yeonjae.tonebridge.application.service;

import lombok.extern.slf4j.Slf4j;
import me.yeonjae.tonebridge.shared.config.PasswordResetProperties;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Emails the operator when a report arrives, so the 24-hour review promised in the terms does not
 * depend on someone opening the admin console. Reuses the password-reset SMTP settings and sends
 * no reported content, only where to look. A failed mail never affects the report itself.
 */
@Slf4j
@Component
public class ContentReportAlertListener {

    private final JavaMailSender sender;
    private final PasswordResetProperties mail;
    private final String alertTo;
    private final String adminUrl;

    public ContentReportAlertListener(@Qualifier("passwordResetMailSender") JavaMailSender sender,
                                      PasswordResetProperties mail,
                                      @Value("${tonebridge.reports.alert-to:}") String alertTo,
                                      @Value("${tonebridge.reports.admin-url:https://tonebridge.mungji.com/admin/reports}") String adminUrl) {
        this.sender = sender;
        this.mail = mail;
        this.alertTo = alertTo;
        this.adminUrl = adminUrl;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onReport(ContentReportService.ReportCreated report) {
        if (!mail.isEnabled() || alertTo.isBlank()) {
            log.warn("Report {} received but no alert mail is configured (tonebridge.reports.alert-to)", report.reportId());
            return;
        }
        try {
            var message = new SimpleMailMessage();
            message.setFrom("ToneBridge <" + mail.getFrom() + ">");
            message.setTo(alertTo);
            message.setSubject("[ToneBridge] 새 신고 " + report.type() + " · " + report.reason());
            message.setText("새 신고가 접수됐습니다. 24시간 안에 검토해 주세요.\n\n"
                    + "신고 ID: " + report.reportId() + "\n대상: " + report.type() + "\n사유: " + report.reason()
                    + "\n\n검토: " + adminUrl);
            sender.send(message);
        } catch (RuntimeException e) {
            log.error("Could not send the alert for report {}", report.reportId(), e);
        }
    }
}
