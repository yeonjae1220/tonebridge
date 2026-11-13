package me.yeonjae.tonebridge.application.service;
import me.yeonjae.tonebridge.application.port.out.*;
import me.yeonjae.tonebridge.shared.config.PasswordResetProperties;
import me.yeonjae.tonebridge.shared.security.PasswordResetRateLimiter;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicReference;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
class PasswordResetDeliveryTest {
    @Test void lookupAndDeliveryRunOnlyAfterHttpDispatchAndFailuresDoNotLeakSecrets() {
        var task=new AtomicReference<Runnable>();Executor executor=task::set;
        var service=mock(PasswordResetService.class);var mail=mock(PasswordResetMailPort.class);
        var tokens=mock(PasswordResetTokenPort.class);var limits=mock(PasswordResetRateLimiter.class);
        var delivery=new PasswordResetDelivery(executor,service,mail,tokens,limits,new PasswordResetProperties());
        String email="PRIVATE_EMAIL@example.test",token="PRIVATE_TOKEN";
        when(service.issue(email)).thenReturn(Optional.of(new PasswordResetService.MailTicket(email,token)));
        when(limits.allowMail()).thenReturn(true);
        doThrow(new IllegalStateException(email+token)).when(mail).send(email,token);
        var logger=(ch.qos.logback.classic.Logger)org.slf4j.LoggerFactory.getLogger(PasswordResetDelivery.class);
        var logs=new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();logs.start();logger.addAppender(logs);
        try {
            delivery.enqueue(email);verifyNoInteractions(service,mail);
            assertThatCode(()->task.get().run()).doesNotThrowAnyException();
            verify(mail).send(email,token);
            assertThat(logs.list.toString()).doesNotContain(email,token);
        } finally {logger.detachAppender(logs);logs.stop();}
    }
    @Test void fullQueueCannotFallBackToSynchronousAccountLookup() {
        var service=mock(PasswordResetService.class);
        var delivery=new PasswordResetDelivery(r->{throw new RejectedExecutionException();},service,
                mock(PasswordResetMailPort.class),mock(PasswordResetTokenPort.class),mock(PasswordResetRateLimiter.class),new PasswordResetProperties());
        assertThatThrownBy(()->delivery.enqueue("test@example.test")).isInstanceOf(me.yeonjae.tonebridge.shared.exception.ToneBridgeException.class);
        verifyNoInteractions(service);
    }
}
