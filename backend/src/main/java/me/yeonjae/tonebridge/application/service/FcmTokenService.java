package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.in.RegisterFcmTokenUseCase;
import me.yeonjae.tonebridge.application.port.out.FcmTokenPort;
import me.yeonjae.tonebridge.domain.user.FcmToken;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class FcmTokenService implements RegisterFcmTokenUseCase {

    private final FcmTokenPort fcmTokenPort;

    @Override
    public void register(Command command) {
        FcmToken token = new FcmToken(
                null,
                command.userId(),
                command.token(),
                command.platform(),
                null,
                null
        );
        fcmTokenPort.saveOrUpdate(token);
    }
}
