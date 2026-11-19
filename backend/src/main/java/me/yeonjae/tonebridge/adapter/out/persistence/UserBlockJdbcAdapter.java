package me.yeonjae.tonebridge.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.UserBlockPort;
import me.yeonjae.tonebridge.shared.exception.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class UserBlockJdbcAdapter implements UserBlockPort {
    private final JdbcTemplate jdbc;
    public boolean existsBetween(UUID a, UUID b) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM user_blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?))", Boolean.class, a,b,b,a));
    }
    public void lockUsers(UUID... users) {
        var participants=java.util.Arrays.stream(users).filter(java.util.Objects::nonNull).distinct().toList();
        if(participants.isEmpty()) throw new ToneBridgeException(ErrorCode.USER_NOT_FOUND);
        String placeholders=String.join(",",java.util.Collections.nCopies(participants.size(),"?"));
        var ids=jdbc.query("SELECT id FROM users WHERE id IN ("+placeholders+") ORDER BY id FOR UPDATE",
                (rs,n) -> rs.getObject(1,UUID.class),participants.toArray());
        if(ids.size()!=participants.size()) throw new ToneBridgeException(ErrorCode.USER_NOT_FOUND);
    }
    public void add(UUID owner, UUID target) {
        jdbc.update("INSERT INTO user_blocks(blocker_id, blocked_id) VALUES (?,?) ON CONFLICT (blocker_id,blocked_id) DO NOTHING", owner,target);
        jdbc.update("DELETE FROM friend_requests WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)", owner,target,target,owner);
    }
    public void remove(UUID owner, UUID target) {
        jdbc.update("DELETE FROM user_blocks WHERE blocker_id=? AND blocked_id=?", owner,target);
    }
    public List<Entry> list(UUID owner, int offset, int limit) {
        return jdbc.query("SELECT b.blocked_id,u.username,b.created_at FROM user_blocks b JOIN users u ON u.id=b.blocked_id WHERE b.blocker_id=? ORDER BY b.created_at DESC,b.blocked_id LIMIT ? OFFSET ?",
            (rs,n) -> new Entry(rs.getObject(1,UUID.class),rs.getString(2),rs.getTimestamp(3).toInstant()), owner,limit,offset);
    }
}
