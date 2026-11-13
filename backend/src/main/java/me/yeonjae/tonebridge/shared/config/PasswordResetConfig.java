package me.yeonjae.tonebridge.shared.config;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import java.net.URI;
import java.util.Set;
import java.util.concurrent.ThreadPoolExecutor;
@Configuration @RequiredArgsConstructor
public class PasswordResetConfig {
    private final PasswordResetProperties properties;
    @Bean("passwordResetMailSender")
    public JavaMailSender passwordResetMailSender() {
        var p=properties;
        if (p.isEnabled()) {
            URI uri=URI.create(p.getBaseUrl());
            boolean local=uri.getHost()!=null && Set.of("localhost","127.0.0.1").contains(uri.getHost());
            if (uri.getHost()==null || uri.getUserInfo()!=null || uri.getQuery()!=null || uri.getFragment()!=null
                    || !("https".equals(uri.getScheme()) || (local && "http".equals(uri.getScheme())))
                    || p.getHost().isBlank() || p.getUsername().isBlank() || p.getPassword().isBlank()
                    || !p.getFrom().matches("[^\\s@<>]+@[^\\s@<>]+\\.[^\\s@<>]+")) {
                throw new IllegalStateException("Password reset requires valid SMTP settings and a trusted HTTPS base URL");
            }
        }
        var sender=new JavaMailSenderImpl();
        sender.setHost(p.getHost());sender.setPort(p.getPort());
        sender.setUsername(p.getUsername());sender.setPassword(p.getPassword());sender.setDefaultEncoding("UTF-8");
        var options=sender.getJavaMailProperties();
        options.setProperty("mail.smtp.auth","true");
        options.setProperty("mail.smtp.starttls.enable","true");
        options.setProperty("mail.smtp.starttls.required","true");
        options.setProperty("mail.smtp.ssl.checkserveridentity","true");
        options.setProperty("mail.smtp.connectiontimeout","5000");
        options.setProperty("mail.smtp.timeout","5000");
        options.setProperty("mail.smtp.writetimeout","5000");
        return sender;
    }
    @Bean("passwordResetExecutor")
    public ThreadPoolTaskExecutor passwordResetExecutor() {
        var executor=new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);executor.setMaxPoolSize(2);executor.setQueueCapacity(32);
        executor.setThreadNamePrefix("password-reset-");
        // Never send synchronously on the HTTP thread: that exposes account existence by timing.
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);executor.setAwaitTerminationSeconds(15);
        return executor;
    }
}
