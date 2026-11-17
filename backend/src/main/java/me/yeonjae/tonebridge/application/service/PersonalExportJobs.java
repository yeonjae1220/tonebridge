package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import me.yeonjae.tonebridge.shared.exception.*;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional
public class PersonalExportJobs {
    public record Job(UUID id,UUID owner,boolean includeAudio,String state,Instant createdAt,Instant expiresAt,Long size,String checks,String failureCode) {}
    private final JdbcTemplate jdbc;
    private static final RowMapper<Job> MAP=(rs,n) -> new Job(rs.getObject("id",UUID.class),rs.getObject("owner_id",UUID.class),rs.getBoolean("include_audio"),rs.getString("state"),rs.getTimestamp("created_at").toInstant(),rs.getTimestamp("expires_at")==null?null:rs.getTimestamp("expires_at").toInstant(),rs.getObject("byte_size",Long.class),rs.getString("access_checks"),rs.getString("failure_code"));
    public Job create(UUID owner,UUID id,boolean audio) {
        jdbc.execute("SELECT pg_advisory_xact_lock(9732001)");
        if(jdbc.queryForList("SELECT id FROM users WHERE id=? FOR UPDATE",UUID.class,owner).isEmpty()) throw new ToneBridgeException(ErrorCode.USER_NOT_FOUND);
        var existing=jdbc.query("SELECT * FROM personal_exports WHERE id=? AND owner_id=?",MAP,id,owner);
        if(!existing.isEmpty()) {
            if(existing.getFirst().includeAudio()!=audio) throw new ToneBridgeException(ErrorCode.CONFLICT);
            return existing.getFirst();
        }
        int recent=jdbc.queryForObject("SELECT count(*) FROM personal_exports WHERE owner_id=? AND created_at>now()-interval '1 hour'",Integer.class,owner);
        int active=jdbc.queryForObject("SELECT count(*) FROM personal_exports WHERE owner_id=? AND state IN ('QUEUED','RUNNING')",Integer.class,owner);
        int queue=jdbc.queryForObject("SELECT count(*) FROM personal_exports WHERE state IN ('QUEUED','RUNNING')",Integer.class);
        if(recent>=2 || active>0 || queue>=32) throw new ToneBridgeException(ErrorCode.TOO_MANY_REQUESTS);
        if(jdbc.update("INSERT INTO personal_exports(id,owner_id,include_audio,state) VALUES (?,?,?,'QUEUED') ON CONFLICT(id) DO NOTHING",id,owner,audio)!=1) throw new ToneBridgeException(ErrorCode.CONFLICT);
        return get(owner,id);
    }
    @Transactional(readOnly=true)
    public Job get(UUID owner,UUID id) {
        return jdbc.query("SELECT * FROM personal_exports WHERE id=? AND owner_id=?",MAP,id,owner).stream().findFirst().orElseThrow(() -> new ToneBridgeException(ErrorCode.RESOURCE_NOT_FOUND));
    }
    @Transactional(readOnly=true)
    public List<Job> list(UUID owner) {
        return jdbc.query("SELECT * FROM personal_exports WHERE owner_id=? ORDER BY created_at DESC,id DESC LIMIT 20",MAP,owner);
    }
    public Optional<Job> claim() {
        return jdbc.query("""
            UPDATE personal_exports SET state='RUNNING',started_at=now()
            WHERE id=(SELECT id FROM personal_exports WHERE state='QUEUED' AND owner_id IS NOT NULL ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1)
            RETURNING *
            """,MAP).stream().findFirst();
    }
    public boolean complete(Job job,long bytes,String checks) {
        return jdbc.update("UPDATE personal_exports SET state='READY',completed_at=now(),expires_at=now()+interval '24 hours',byte_size=?,access_checks=?::jsonb WHERE id=? AND owner_id=? AND state='RUNNING'",bytes,checks,job.id(),job.owner())==1;
    }
    public void fail(UUID id,String reason) {
        jdbc.update("UPDATE personal_exports SET state='FAILED',failure_code=?,access_checks=NULL WHERE id=? AND state='RUNNING'",reason,id);
    }
    public Job download(UUID owner,UUID id) {
        var job=get(owner,id);
        if(!"READY".equals(job.state()) || job.expiresAt()==null || !job.expiresAt().isAfter(Instant.now())) throw new ToneBridgeException(ErrorCode.EXPORT_NOT_READY);
        if(jdbc.update("UPDATE personal_exports SET download_count=download_count+1 WHERE id=? AND owner_id=? AND state='READY' AND expires_at>now() AND download_count<20",id,owner)!=1) throw new ToneBridgeException(ErrorCode.TOO_MANY_REQUESTS);
        return job;
    }
    public List<UUID> cleanupCandidates() {
        // Interrupted jobs are marked failed; never hide an incomplete archive as ready.
        jdbc.update("UPDATE personal_exports SET state='FAILED',failure_code='INTERRUPTED' WHERE state='RUNNING' AND started_at<now()-interval '10 minutes'");
        jdbc.update("UPDATE personal_exports SET state='EXPIRED',access_checks=NULL WHERE (state='READY' AND expires_at<=now()) OR owner_id IS NULL OR (state='QUEUED' AND created_at<now()-interval '1 day')");
        return jdbc.queryForList("SELECT id FROM personal_exports WHERE state IN ('FAILED','EXPIRED') AND NOT artifact_deleted ORDER BY created_at LIMIT 20",UUID.class);
    }
    public void needsCleanup(UUID id) { jdbc.update("UPDATE personal_exports SET artifact_deleted=false WHERE id=?",id); }
    public void artifactDeleted(UUID id) {
        jdbc.update("UPDATE personal_exports SET artifact_deleted=true,access_checks=NULL WHERE id=? AND state IN ('FAILED','EXPIRED')",id);
    }
}
