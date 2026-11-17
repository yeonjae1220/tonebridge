package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.UserBlockPort;
import me.yeonjae.tonebridge.application.port.out.StudySessionPort;
import me.yeonjae.tonebridge.shared.exception.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class UserBlockService {
    private final UserBlockPort blocks;
    private final StudySessionPort sessions;
    @Transactional(readOnly=true)
    public boolean blocked(UUID a, UUID b) {
        return a != null && b != null && !a.equals(b) && blocks.existsBetween(a,b);
    }
    @Transactional(readOnly=true)
    public void requireAllowed(UUID a, UUID b) {
        if (blocked(a,b)) throw new ToneBridgeException(ErrorCode.INTERACTION_UNAVAILABLE);
    }
    public void lockAllowed(UUID a, UUID b) {
        blocks.lockUsers(a,b);
        requireAllowed(a,b);
    }
    public void block(UUID owner, UUID target) {
        if (owner.equals(target)) throw new ToneBridgeException(ErrorCode.INVALID_INPUT);
        blocks.lockUsers(owner,target);
        // Same user locks as friend acceptance and shared notebook creation.
        blocks.add(owner,target);
        sessions.closeSharedBetween(owner,target);
    }
    public void unblock(UUID owner, UUID target) {
        blocks.lockUsers(owner,target);
        blocks.remove(owner,target);
    }
    @Transactional(readOnly=true)
    public List<UserBlockPort.Entry> list(UUID owner, int page) { return blocks.list(owner,page*50,51); }
}
