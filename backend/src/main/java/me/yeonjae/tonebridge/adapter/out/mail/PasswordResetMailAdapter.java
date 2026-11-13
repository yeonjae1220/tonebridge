package me.yeonjae.tonebridge.adapter.out.mail;
import me.yeonjae.tonebridge.application.port.out.PasswordResetMailPort;
import me.yeonjae.tonebridge.shared.config.PasswordResetProperties;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;
@Component
public class PasswordResetMailAdapter implements PasswordResetMailPort {
    private final JavaMailSender sender;
    private final PasswordResetProperties properties;
    public PasswordResetMailAdapter(@Qualifier("passwordResetMailSender") JavaMailSender sender,PasswordResetProperties properties) {
        this.sender=sender;this.properties=properties;
    }
    public void send(String email,String token) {
        String link=properties.getBaseUrl().replaceAll("/+$","")+"/reset-password#token="+token;
        var message=new SimpleMailMessage();
        message.setFrom("ToneBridge <"+properties.getFrom()+">");message.setTo(email);
        message.setSubject("ToneBridge 비밀번호 재설정 / Reset your password");
        message.setText("ToneBridge 비밀번호 재설정 요청을 받았습니다. 아래 링크는 15분 동안 한 번만 사용할 수 있습니다.\n"
                +"Use this link once within 15 minutes to reset your ToneBridge password.\n\n"+link
                +"\n\n요청하지 않았다면 이 메일을 무시하세요. 링크를 열기만 해서는 비밀번호가 바뀌지 않습니다."
                +"\nIf you did not request this, ignore this email. Opening the link alone does not change your password."
                +"\n\n재설정 완료 후 모든 기기에서 다시 로그인해야 합니다. / Sign in again on all devices after resetting.");
        sender.send(message);
    }
}
