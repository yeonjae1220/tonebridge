package me.yeonjae.tonebridge.adapter.out.persistence;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ValidationLocalCompatibilityTest {
    @Test void disabledPilotDoesNotQueryMissingNativeTablesInLocalH2() {
        var jdbc=new JdbcTemplate(new DriverManagerDataSource("jdbc:h2:mem:validation-local","sa",""));
        var policy=new ValidationCollectionPolicy(jdbc,false);
        assertThat(policy.allowsUser(UUID.randomUUID())).isFalse();
        var repository=mock(LearningActivityRepository.class);
        new LearningActivityRecorder(repository,policy,jdbc).purgeExpired();
        verify(repository).deleteByOccurredAtBefore(any());
        assertThatThrownBy(() -> new ValidationCollectionPolicy(jdbc,true))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("PostgreSQL");
    }
}
