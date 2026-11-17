package me.yeonjae.tonebridge.application.service;

import jakarta.validation.constraints.*;
import me.yeonjae.tonebridge.application.port.out.PrivateFilePort;
import me.yeonjae.tonebridge.shared.exception.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.io.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.Semaphore;
import java.util.function.Supplier;

/** Authenticated, immutable assets; no writable object URL is issued to the browser. */
@Service
public class CloudAudioFiles {
    public static final long MAX_FILE=50L*1024*1024, MAX_ACCOUNT=100L*1024*1024;
    public record Reservation(@NotNull UUID epoch,@NotNull UUID draftId,@Min(1) @Max(MAX_FILE) long byteSize,
                              @NotBlank String contentType,@Pattern(regexp="[a-f0-9]{64}") @NotNull String sha256) {}
    public record Info(UUID id,String state,long byteSize,String contentType,String sha256,Instant expiresAt) {}
    public record Download(Info info,InputStream input) {}
    record Asset(UUID id,UUID owner,UUID epoch,UUID draftId,long size,String type,String sha,String key,String state,Instant expires,Instant lease) {
        Info info(){return new Info(id,state,size,type,sha,expires);}
    }
    private final JdbcTemplate jdbc;
    private final PrivateFilePort files;
    private final TransactionTemplate transactions;
    private final Semaphore uploads=new Semaphore(2);
    private static final Map<String,String> TYPES=Map.of("audio/webm","webm","audio/mp4","m4a","audio/ogg","ogg","audio/wav","wav");
    private static final RowMapper<Asset> ROW=(rs,n) -> new Asset(rs.getObject("id",UUID.class),rs.getObject("owner_id",UUID.class),rs.getObject("epoch",UUID.class),rs.getObject("draft_id",UUID.class),rs.getLong("byte_size"),rs.getString("content_type"),rs.getString("sha256"),rs.getString("object_key"),rs.getString("state"),rs.getTimestamp("expires_at").toInstant(),rs.getTimestamp("lease_until")==null?null:rs.getTimestamp("lease_until").toInstant());
    public CloudAudioFiles(JdbcTemplate jdbc,PrivateFilePort files,PlatformTransactionManager manager){this.jdbc=jdbc;this.files=files;this.transactions=new TransactionTemplate(manager);}
    private <T> T tx(Supplier<T> work){return transactions.execute(status -> work.get());}
    public Info reserve(UUID owner,UUID id,Reservation input) {
        return tx(() -> {
            lock(owner);consent(owner,input.epoch());
            if(!TYPES.containsKey(input.contentType()) || input.byteSize()<1 || input.byteSize()>MAX_FILE || input.sha256()==null || !input.sha256().matches("[a-f0-9]{64}"))fail(ErrorCode.INVALID_INPUT);
            var old=find(id);
            if(old!=null) {
                if(!owner.equals(old.owner()))fail(ErrorCode.RESOURCE_NOT_FOUND);
                if(!old.epoch().equals(input.epoch()) || !old.draftId().equals(input.draftId()) || old.size()!=input.byteSize() || !old.type().equals(input.contentType()) || !old.sha().equals(input.sha256()))fail(ErrorCode.CONFLICT);
                return old.info();
            }
            long recent=jdbc.queryForObject("SELECT count(*) FROM cloud_audio_assets WHERE owner_id=? AND created_at>now()-interval '1 hour'",Long.class,owner);
            if(recent>=30)fail(ErrorCode.TOO_MANY_REQUESTS);
            var target=jdbc.queryForList("SELECT kind,state FROM cloud_drafts WHERE owner_id=? AND id=?",owner,input.draftId());
            if(!target.isEmpty() && (!"recording".equals(target.getFirst().get("kind")) || !"ACTIVE".equals(target.getFirst().get("state"))))fail(ErrorCode.CONFLICT);
            long used=jdbc.queryForObject("SELECT coalesce(sum(byte_size),0) FROM cloud_audio_assets WHERE owner_id=? AND state<>'DELETED'",Long.class,owner);
            long active=jdbc.queryForObject("SELECT count(*) FROM cloud_drafts WHERE owner_id=? AND state='ACTIVE' AND expires_at>now()",Long.class,owner);
            long reservations=jdbc.queryForObject("SELECT count(DISTINCT a.draft_id) FROM cloud_audio_assets a WHERE a.owner_id=? AND a.state IN ('RESERVED','UPLOADING','READY') AND a.expires_at>now() AND a.draft_id<>? AND NOT EXISTS(SELECT 1 FROM cloud_drafts d WHERE d.owner_id=a.owner_id AND d.id=a.draft_id AND d.state='ACTIVE' AND d.expires_at>now())",Long.class,owner,input.draftId());
            long unfinished=jdbc.queryForObject("SELECT count(*) FROM cloud_audio_assets WHERE owner_id=? AND state IN ('RESERVED','UPLOADING')",Long.class,owner);
            if(used+input.byteSize()>MAX_ACCOUNT || unfinished>=50 || (target.isEmpty() && active+reservations>=50))fail(ErrorCode.PAYLOAD_TOO_LARGE);
            String key="private-draft-audio/"+id+"."+TYPES.get(input.contentType());
            jdbc.update("INSERT INTO cloud_audio_assets(id,owner_id,epoch,draft_id,byte_size,content_type,sha256,object_key,state) VALUES (?,?,?,?,?,?,?,?,'RESERVED') ON CONFLICT(id) DO NOTHING",id,owner,input.epoch(),input.draftId(),input.byteSize(),input.contentType(),input.sha256(),key);
            return owned(owner,id).info();
        });
    }
    public Info info(UUID owner,UUID id){return tx(() -> {lock(owner);return owned(owner,id).info();});}
    public Info upload(UUID owner,UUID id,InputStream input,String contentType,long contentLength) {
        if(!uploads.tryAcquire())fail(ErrorCode.TOO_MANY_REQUESTS);
        Asset asset=null;Path temporary=null;
        try {
            asset=tx(() -> {
                lock(owner);var a=owned(owner,id);consent(owner,a.epoch());
                if(!a.type().equals(contentType) || (contentLength>=0 && a.size()!=contentLength))fail(ErrorCode.INVALID_INPUT);
                if("READY".equals(a.state()))return a;
                if(!"RESERVED".equals(a.state()) || !a.expires().isAfter(Instant.now()))fail(ErrorCode.CONFLICT);
                if(jdbc.queryForObject("SELECT count(*) FROM cloud_audio_assets WHERE owner_id=? AND state='UPLOADING'",Integer.class,owner)>0)fail(ErrorCode.CONFLICT);
                jdbc.update("UPDATE cloud_audio_assets SET state='UPLOADING',lease_until=now()+interval '5 minutes' WHERE id=?",id);return owned(owner,id);
            });
            if("READY".equals(asset.state()))return asset.info();
            temporary=Files.createTempFile("tonebridge-draft-audio-",".upload");
            var digest=MessageDigest.getInstance("SHA-256");long size=0;byte[] buffer=new byte[64*1024],prefix=new byte[16];int prefixSize=0;
            Instant deadline=Instant.now().plusSeconds(90);
            try(var output=Files.newOutputStream(temporary)) {
                int count;
                while((count=input.read(buffer))!=-1) {
                    size+=count;if(size>asset.size() || Instant.now().isAfter(deadline))fail(ErrorCode.PAYLOAD_TOO_LARGE);
                    int take=Math.min(count,prefix.length-prefixSize);if(take>0){System.arraycopy(buffer,0,prefix,prefixSize,take);prefixSize+=take;}
                    digest.update(buffer,0,count);output.write(buffer,0,count);
                }
            }
            if(size!=asset.size() || !HexFormat.of().formatHex(digest.digest()).equals(asset.sha()) || !matchesType(asset.type(),prefix,prefixSize))fail(ErrorCode.INVALID_INPUT);
            tx(() -> {lock(owner);var a=owned(owner,id);consent(owner,a.epoch());if(!"UPLOADING".equals(a.state()) || a.lease()==null || !a.lease().isAfter(Instant.now().plusSeconds(125)))fail(ErrorCode.CONFLICT);return null;});
            files.put(asset.key(),temporary,asset.type());
            return tx(() -> {
                lock(owner);var a=owned(owner,id);consent(owner,a.epoch());
                if(!"UPLOADING".equals(a.state()) || a.lease()==null || !a.lease().isAfter(Instant.now()))fail(ErrorCode.CONFLICT);
                jdbc.update("UPDATE cloud_audio_assets SET state='READY',expires_at=now()+interval '15 minutes' WHERE id=?",id);
                return owned(owner,id).info();
            });
        } catch(Exception failure) {
            if(asset!=null && !"READY".equals(asset.state())) jdbc.update("UPDATE cloud_audio_assets SET state='DELETING' WHERE id=? AND state='UPLOADING'",id);
            if(failure instanceof ToneBridgeException known)throw known;
            throw new ToneBridgeException(ErrorCode.FILE_UPLOAD_FAILED);
        } finally {
            uploads.release();if(temporary!=null)try{Files.deleteIfExists(temporary);}catch(IOException ignored){/* Private bounded temporary file, no content logged. */}
        }
    }
    /** Called while the draft service holds this owner's row lock. */
    public void requireReady(UUID owner,UUID id) {
        var a=owned(owner,id);
        if(!"READY".equals(a.state()) || (!a.expires().isAfter(Instant.now()) && !referenced(owner,id)))fail(ErrorCode.CONFLICT);
        consent(owner,a.epoch());
    }
    public Download download(UUID owner,UUID id) {
        Asset a=tx(() -> {lock(owner);var item=owned(owner,id);if(!"READY".equals(item.state()) || !referenced(owner,id))fail(ErrorCode.RESOURCE_NOT_FOUND);return item;});
        return new Download(a.info(),files.open(a.key(),MAX_FILE));
    }
    boolean referenced(UUID owner,UUID id) {
        if(owner==null)return false;
        return Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM cloud_drafts d WHERE d.owner_id=? AND d.kind='recording' AND d.state='ACTIVE' AND d.expires_at>now()
              AND (d.value->>'assetId'=? OR EXISTS(SELECT 1 FROM cloud_draft_revisions r WHERE r.owner_id=d.owner_id AND r.draft_id=d.id AND r.expires_at>now() AND r.value->>'assetId'=?)))
            """,Boolean.class,owner,id.toString(),id.toString()));
    }
    public void cleanup() {
        var ids=jdbc.queryForList("SELECT id FROM cloud_audio_assets WHERE cleanup_after<=now() AND (state IN ('DELETING','DELETED') OR owner_id IS NULL OR expires_at<=now() OR NOT EXISTS(SELECT 1 FROM cloud_draft_settings s WHERE s.owner_id=cloud_audio_assets.owner_id AND s.epoch=cloud_audio_assets.epoch)) ORDER BY cleanup_after,id LIMIT 50",UUID.class);
        for(UUID id:ids)try {
            Asset remove=tx(() -> {
                var candidate=find(id);if(candidate==null)return null;
                if(candidate.owner()!=null)jdbc.queryForList("SELECT id FROM users WHERE id=? FOR UPDATE",UUID.class,candidate.owner());
                var a=jdbc.query("SELECT * FROM cloud_audio_assets WHERE id=? FOR UPDATE",ROW,id).stream().findFirst().orElse(null);if(a==null)return null;
                if(a.lease()!=null && a.lease().plusSeconds(120).isAfter(Instant.now())){jdbc.update("UPDATE cloud_audio_assets SET cleanup_after=lease_until+interval '120 seconds' WHERE id=?",id);return null;}
                boolean sameEpoch=a.owner()!=null && Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM cloud_draft_settings WHERE owner_id=? AND epoch=?)",Boolean.class,a.owner(),a.epoch()));
                if("READY".equals(a.state()) && sameEpoch && referenced(a.owner(),id)) {jdbc.update("UPDATE cloud_audio_assets SET cleanup_after=now()+interval '1 minute' WHERE id=?",id);return null;}
                if(sameEpoch && !Set.of("DELETING","DELETED").contains(a.state()) && a.expires().isAfter(Instant.now()))return null;
                jdbc.update("UPDATE cloud_audio_assets SET state='DELETING' WHERE id=?",id);return a;
            });
            if(remove!=null) {
                files.delete(remove.key());
                // Repeat deletion briefly to cover a storage response lost while the upload was finishing.
                jdbc.update("UPDATE cloud_audio_assets SET state='DELETED',cleanup_after=now()+interval '1 hour' WHERE id=? AND state='DELETING'",id);
            }
        }catch(RuntimeException ignored){jdbc.update("UPDATE cloud_audio_assets SET cleanup_after=now()+interval '1 minute' WHERE id=?",id);/* Keep the object key for retry. */}
        jdbc.update("DELETE FROM cloud_audio_assets WHERE state='DELETED' AND created_at<now()-interval '8 days'");
    }
    private Asset find(UUID id){return jdbc.query("SELECT * FROM cloud_audio_assets WHERE id=?",ROW,id).stream().findFirst().orElse(null);}
    private Asset owned(UUID owner,UUID id){var a=find(id);if(a==null || !owner.equals(a.owner()))fail(ErrorCode.RESOURCE_NOT_FOUND);return a;}
    private void lock(UUID owner){if(jdbc.queryForList("SELECT id FROM users WHERE id=? FOR UPDATE",UUID.class,owner).isEmpty())fail(ErrorCode.RESOURCE_NOT_FOUND);}
    private void consent(UUID owner,UUID epoch){if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM cloud_draft_settings WHERE owner_id=? AND epoch=? AND enabled AND audio_enabled)",Boolean.class,owner,epoch)))fail(ErrorCode.CONFLICT);}
    private static boolean matchesType(String type,byte[] bytes,int size) {
        if(size<12)return false;
        return switch(type) {
            case "audio/webm" -> (bytes[0]&255)==0x1a && (bytes[1]&255)==0x45 && (bytes[2]&255)==0xdf && (bytes[3]&255)==0xa3;
            case "audio/ogg" -> bytes[0]=='O' && bytes[1]=='g' && bytes[2]=='g' && bytes[3]=='S';
            case "audio/mp4" -> bytes[4]=='f' && bytes[5]=='t' && bytes[6]=='y' && bytes[7]=='p';
            case "audio/wav" -> bytes[0]=='R' && bytes[1]=='I' && bytes[2]=='F' && bytes[3]=='F' && bytes[8]=='W' && bytes[9]=='A' && bytes[10]=='V' && bytes[11]=='E';
            default -> false;
        };
    }
    private static void fail(ErrorCode code){throw new ToneBridgeException(code);}
}
