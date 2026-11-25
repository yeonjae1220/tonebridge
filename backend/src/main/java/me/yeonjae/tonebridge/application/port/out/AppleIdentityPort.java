package me.yeonjae.tonebridge.application.port.out;

import java.util.Optional;
import java.util.UUID;

/** Links a ToneBridge account to its Apple `sub`. */
public interface AppleIdentityPort {

    Optional<UUID> findUserIdBySub(String appleSub);

    void link(UUID userId, String appleSub);
}
