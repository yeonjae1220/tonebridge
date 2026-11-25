package me.yeonjae.tonebridge.adapter.out.persistence;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.AppleIdentityPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class AppleIdentityJdbcAdapter implements AppleIdentityPort {

    private final JdbcTemplate jdbc;
    private final EntityManager entityManager;

    @Override
    public Optional<UUID> findUserIdBySub(String appleSub) {
        return jdbc.query("SELECT user_id FROM user_apple_identities WHERE apple_sub = ?",
                (rs, n) -> rs.getObject(1, UUID.class), appleSub).stream().findFirst();
    }

    @Override
    public void link(UUID userId, String appleSub) {
        // A user created in this transaction is still only in Hibernate's queue; JDBC would hit the FK.
        entityManager.flush();
        jdbc.update("INSERT INTO user_apple_identities (apple_sub, user_id) VALUES (?, ?)", appleSub, userId);
    }
}
