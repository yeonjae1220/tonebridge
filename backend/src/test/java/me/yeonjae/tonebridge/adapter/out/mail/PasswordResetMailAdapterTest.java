package me.yeonjae.tonebridge.adapter.out.mail;
import me.yeonjae.tonebridge.shared.config.*;
import org.junit.jupiter.api.Test;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.mockito.ArgumentCaptor;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
class PasswordResetMailAdapterTest {
    @Test void mailUsesConfiguredOriginAndFragmentWithoutCredentialsInSubject() {
        var p=new PasswordResetProperties();p.setFrom("sender@example.test");p.setBaseUrl("https://tonebridge.example.test/");
        var sender=mock(JavaMailSender.class);new PasswordResetMailAdapter(sender,p).send("recipient@example.test","A".repeat(43));
        var captured=ArgumentCaptor.forClass(SimpleMailMessage.class);verify(sender).send(captured.capture());
        var mail=captured.getValue();assertThat(mail.getSubject()).doesNotContain("A".repeat(43));
        assertThat(mail.getText()).contains("https://tonebridge.example.test/reset-password#token="+"A".repeat(43)).doesNotContain("?token=");
    }
    @Test void smtpRequiresVerifiedTlsAndFiniteTimeoutsAndRejectsUntrustedLinkSettings() {
        var p=new PasswordResetProperties();p.setEnabled(true);p.setHost("smtp.example.test");p.setUsername("user");p.setPassword("test-only");p.setFrom("sender@example.test");p.setBaseUrl("https://tonebridge.example.test");
        var sender=(JavaMailSenderImpl)new PasswordResetConfig(p).passwordResetMailSender();
        assertThat(sender.getJavaMailProperties()).containsEntry("mail.smtp.starttls.required","true").containsEntry("mail.smtp.ssl.checkserveridentity","true")
                .containsEntry("mail.smtp.timeout","5000");
        for(String url:new String[]{"http://outside.example","https://user@outside.example","https://outside.example?token=x"}) {
            p.setBaseUrl(url);assertThatThrownBy(()->new PasswordResetConfig(p).passwordResetMailSender()).isInstanceOf(IllegalStateException.class);
        }
    }
}
