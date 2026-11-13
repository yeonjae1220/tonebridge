package me.yeonjae.tonebridge.shared.config;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
@Getter @Setter @Component
@ConfigurationProperties(prefix="tonebridge.password-reset")
public class PasswordResetProperties {
    private boolean enabled;
    private String host="";
    private int port=587;
    private String username="";
    private String password="";
    private String from="";
    private String baseUrl="http://localhost:3000";
    private int requestPerIp=10;
    private int requestPerEmail=3;
    private int mailPerDay=100;
    private int confirmationPerIp=20;
}
