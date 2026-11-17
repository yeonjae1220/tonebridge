package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import me.yeonjae.tonebridge.shared.exception.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/** Owner row locks serialize CAS, quotas, erasure and submission receipts. */
@Service
@Transactional
@RequiredArgsConstructor
public class CloudDraftService {
    public record Settings(boolean enabled,UUID epoch,long version,boolean audioEnabled) {
        public Settings(boolean enabled,UUID epoch,long version){this(enabled,epoch,version,false);}
    }
    public record AudioPreferences(@NotNull UUID operationId,@Min(0) long expectedVersion,boolean enabled) {}
    public record Preferences(@NotNull UUID operationId,@Min(0) long expectedVersion,boolean enabled,boolean erase) {}
    public record Write(@NotNull UUID operationId,@NotNull UUID epoch,@Min(0) long expectedVersion,
                        @NotBlank String kind,@NotBlank String scope,@NotNull Map<String,Object> value,@NotNull Long editedAt) {
        public Write(UUID operationId,UUID epoch,long expectedVersion,String kind,String scope,Map<String,Object> value) {
            this(operationId,epoch,expectedVersion,kind,scope,value,System.currentTimeMillis());
        }
    }
    public record Change(@NotNull UUID operationId,@NotNull UUID epoch,@Min(1) long expectedVersion) {}
    public record Prepare(@NotNull UUID epoch,@Min(1) long expectedVersion,@NotNull UUID operation,
                          @NotBlank String kind,Map<String,Object> payload) {}
    public record Applied(UUID id,long version) {}
    public record Draft(UUID id,String kind,String scope,long version,String state,Map<String,Object> value,
                        Instant updatedAt,Instant expiresAt,UUID pendingOperation,String pendingKind,Map<String,Object> pendingPayload) {}
    public record Revision(long version,Map<String,Object> value,Instant createdAt,Instant expiresAt) {}
    private final JdbcTemplate jdbc;
    private final CloudAudioFiles audioFiles;
    private static final ObjectMapper JSON=new ObjectMapper().enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);
    private static final long MAX_TEXT_BYTES=25L*1024*1024;
    private static final RowMapper<Draft> ROW=(rs,n) -> new Draft(rs.getObject("id",UUID.class),rs.getString("kind"),rs.getString("scope"),rs.getLong("version"),rs.getString("state"),decode(rs.getString("value")),rs.getTimestamp("updated_at").toInstant(),rs.getTimestamp("expires_at")==null?null:rs.getTimestamp("expires_at").toInstant(),rs.getObject("pending_operation",UUID.class),rs.getString("pending_kind"),decode(rs.getString("pending_payload")));

    @Transactional(readOnly=true)
    public Settings settings(UUID owner) {
        return jdbc.query("SELECT enabled,epoch,version,audio_enabled FROM cloud_draft_settings WHERE owner_id=?",
                (rs,n) -> new Settings(rs.getBoolean(1),rs.getObject(2,UUID.class),rs.getLong(3),rs.getBoolean(4)),owner)
                .stream().findFirst().orElse(new Settings(false,null,0));
    }
    public Settings preferences(UUID owner,Preferences input) {
        lock(owner);
        String hash=hash(Arrays.asList("preferences",input));
        if(replay(owner,input.operationId(),hash)!=null) return settings(owner);
        var current=settings(owner);
        if(current.version()!=input.expectedVersion() || (input.erase() && input.enabled())) conflict();
        if(!input.erase() && current.enabled()==input.enabled()) return current;
        if(input.erase() || input.enabled()) {
            int changes=jdbc.queryForObject("SELECT count(*) FROM cloud_draft_operations WHERE owner_id=? AND draft_id IS NULL AND created_at>now()-interval '1 minute'",Integer.class,owner);
            if(changes>=30)throw new ToneBridgeException(ErrorCode.TOO_MANY_REQUESTS);
        }
        UUID epoch=current.epoch()==null || input.erase()?UUID.randomUUID():current.epoch();
        if(input.erase()) {
            for(var draft:allActive(owner)) cancelReceipt(owner,draft);
            jdbc.update("DELETE FROM cloud_drafts WHERE owner_id=?",owner);
            jdbc.update("UPDATE personal_exports SET state='EXPIRED',expires_at=now(),access_checks=NULL WHERE owner_id=? AND state='READY' AND jsonb_exists(access_checks,'cloudDrafts')",owner);
        }
        long version=current.version()+1;
        jdbc.update("INSERT INTO cloud_draft_settings(owner_id,enabled,epoch,version,audio_enabled) VALUES (?,?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET enabled=excluded.enabled,epoch=excluded.epoch,version=excluded.version,audio_enabled=excluded.audio_enabled",owner,input.enabled(),epoch,version,input.enabled() && current.audioEnabled());
        remember(owner,input.operationId(),hash,null,version);
        return new Settings(input.enabled(),epoch,version,input.enabled() && current.audioEnabled());
    }
    public Settings audioPreferences(UUID owner,AudioPreferences input) {
        lock(owner);String hash=hash(Arrays.asList("audio-preferences",input));
        if(replay(owner,input.operationId(),hash)!=null)return settings(owner);
        var current=settings(owner);
        if(current.version()!=input.expectedVersion() || (input.enabled() && !current.enabled()))conflict();
        if(current.audioEnabled()==input.enabled())return current;
        if(input.enabled() && jdbc.queryForObject("SELECT count(*) FROM cloud_draft_operations WHERE owner_id=? AND draft_id IS NULL AND created_at>now()-interval '1 minute'",Integer.class,owner)>=30)throw new ToneBridgeException(ErrorCode.TOO_MANY_REQUESTS);
        jdbc.update("UPDATE cloud_draft_settings SET audio_enabled=?,version=version+1 WHERE owner_id=?",input.enabled(),owner);
        remember(owner,input.operationId(),hash,null,current.version()+1);return settings(owner);
    }
    @Transactional(readOnly=true)
    public Applied operation(UUID owner,UUID operation) {
        return jdbc.query("SELECT draft_id,applied_version FROM cloud_draft_operations WHERE owner_id=? AND operation_id=?",
                (rs,n) -> new Applied(rs.getObject(1,UUID.class),rs.getLong(2)),owner,operation).stream().findFirst().orElseThrow(() -> new ToneBridgeException(ErrorCode.RESOURCE_NOT_FOUND));
    }
    public List<Draft> list(UUID owner) { lock(owner);expire(owner);return allActive(owner); }
    public Draft get(UUID owner,UUID id) { lock(owner);expire(owner);return required(owner,id); }
    public List<Revision> history(UUID owner,UUID id) {
        lock(owner);expire(owner);var draft=required(owner,id);active(draft);
        return jdbc.query("SELECT version,value,created_at,expires_at FROM cloud_draft_revisions WHERE owner_id=? AND draft_id=? AND expires_at>now() ORDER BY version DESC LIMIT 20",
                (rs,n) -> new Revision(rs.getLong(1),decode(rs.getString(2)),rs.getTimestamp(3).toInstant(),rs.getTimestamp(4).toInstant()),owner,id);
    }
    public Applied write(UUID owner,UUID id,Write input) {
        lock(owner);requireEpoch(owner,input.epoch(),true);expire(owner);
        String hash=hash(Arrays.asList("write",id,input));var replay=replay(owner,input.operationId(),hash);if(replay!=null)return replay;
        checkWriteRate(owner);
        validate(input.kind(),input.scope(),input.value());
        if(input.kind().equals("recording"))audioFiles.requireReady(owner,UUID.fromString((String)input.value().get("assetId")));
        Instant edited=editTime(input.editedAt());
        var previous=find(owner,id);
        if(previous==null) {
            if(input.expectedVersion()!=0) conflict();
            int count=jdbc.queryForObject("SELECT count(*) FROM cloud_drafts WHERE owner_id=? AND state='ACTIVE'",Integer.class,owner);
            if(count>=50) throw new ToneBridgeException(ErrorCode.PAYLOAD_TOO_LARGE);
            jdbc.update("INSERT INTO cloud_drafts(owner_id,id,kind,scope,version,state,value,expires_at) VALUES (?,?,?,?,0,'ACTIVE',NULL,now()+interval '7 days')",owner,id,input.kind(),input.scope());
        } else {
            editable(previous,input.expectedVersion());
            if(!previous.kind().equals(input.kind()) || !previous.scope().equals(input.scope())) conflict();
            if(encode(previous.value()).equals(encode(input.value()))) {
                remember(owner,input.operationId(),hash,id,previous.version());return new Applied(id,previous.version());
            }
        }
        long version=input.expectedVersion()+1;
        saveVersion(owner,id,version,input.value(),edited);
        remember(owner,input.operationId(),hash,id,version);return new Applied(id,version);
    }
    public Applied restore(UUID owner,UUID id,long revision,Change input) {
        lock(owner);requireEpoch(owner,input.epoch(),true);expire(owner);
        String hash=hash(Arrays.asList("restore",id,revision,input));var replay=replay(owner,input.operationId(),hash);if(replay!=null)return replay;
        checkWriteRate(owner);
        var draft=required(owner,id);editable(draft,input.expectedVersion());
        var values=jdbc.queryForList("SELECT value::text FROM cloud_draft_revisions WHERE owner_id=? AND draft_id=? AND version=? AND expires_at>now()",String.class,owner,id,revision);
        if(values.isEmpty()) missing();
        var value=decode(values.getFirst());
        if(draft.kind().equals("recording"))audioFiles.requireReady(owner,UUID.fromString((String)value.get("assetId")));
        long version=draft.version()+1;saveVersion(owner,id,version,value,Instant.now());
        remember(owner,input.operationId(),hash,id,version);return new Applied(id,version);
    }
    public Applied delete(UUID owner,UUID id,Change input) {
        lock(owner);requireEpoch(owner,input.epoch(),false);expire(owner);
        String hash=hash(Arrays.asList("delete",id,input));var replay=replay(owner,input.operationId(),hash);if(replay!=null)return replay;
        var draft=required(owner,id);editable(draft,input.expectedVersion());
        retire(owner,draft,"DELETED");long version=draft.version()+1;
        remember(owner,input.operationId(),hash,id,version);return new Applied(id,version);
    }
    /** Claim the existing durable operation before posting. Other devices cannot start a new operation. */
    public Draft prepare(UUID owner,UUID id,Prepare input) {
        lock(owner);var preferences=requireEpoch(owner,input.epoch(),false);expire(owner);
        var draft=required(owner,id);
        if(!Set.of("COMPOSITION","SUBMISSION").contains(input.kind()) || ((draft.kind().equals("editor") || draft.scope().equals("audio:compose"))!=input.kind().equals("COMPOSITION"))) invalid();
        if(input.payload()!=null && encode(input.payload()).getBytes(StandardCharsets.UTF_8).length>200000) throw new ToneBridgeException(ErrorCode.PAYLOAD_TOO_LARGE);
        if(draft.pendingOperation()!=null) {
            if(!draft.pendingOperation().equals(input.operation()) || !draft.pendingKind().equals(input.kind())) conflict();
            if(draft.pendingPayload()!=null && !encode(draft.pendingPayload()).equals(encode(input.payload()))) conflict();
            return draft;
        }
        editable(draft,input.expectedVersion());
        for(var other:pending(owner,input.operation(),input.kind())) if(other.kind().equals(draft.kind()) || !submissionScope(other).equals(submissionScope(draft)))conflict();
        String receiptTable=input.kind().equals("COMPOSITION")?"composition_receipts":"submission_receipts";
        var receipts=jdbc.queryForList("SELECT cancelled,fingerprint FROM "+receiptTable+" WHERE owner_id=? AND operation_id=?",owner,input.operation());
        if(!receipts.isEmpty()) {
            if(Boolean.TRUE.equals(receipts.getFirst().get("cancelled"))) conflict();
            if(receipts.getFirst().get("fingerprint")!=null) {retire(owner,draft,"SUBMITTED");return required(owner,id);}
        }
        // Turning sync off preserves cloud data but prevents uploading any further text.
        String payload=preferences.enabled() && (!draft.kind().equals("recording") || preferences.audioEnabled()) && input.payload()!=null?encode(input.payload()):null;
        jdbc.update("UPDATE cloud_drafts SET version=version+1,pending_operation=?,pending_kind=?,pending_payload=?::jsonb WHERE owner_id=? AND id=?",input.operation(),input.kind(),payload,owner,id);
        return required(owner,id);
    }
    /** Called inside the existing receipt transaction, after its owner/pair locks. */
    public void completeSubmission(UUID owner,UUID operation,String kind) {
        if(operation==null)return;
        for(var draft:pending(owner,operation,kind)) retire(owner,draft,"SUBMITTED");
    }
    public void cancelledSubmission(UUID owner,UUID operation,String kind) {
        if(operation==null)return;
        jdbc.update("UPDATE cloud_drafts SET version=version+1,pending_operation=NULL,pending_kind=NULL,pending_payload=NULL WHERE owner_id=? AND pending_operation=? AND pending_kind=? AND state='ACTIVE'",owner,operation,kind);
    }
    @Transactional(readOnly=true)
    public List<UUID> expiredOwners() {
        return jdbc.queryForList("SELECT owner_id FROM cloud_drafts WHERE state='ACTIVE' AND expires_at<=now() UNION SELECT owner_id FROM cloud_draft_revisions WHERE expires_at<=now() UNION SELECT owner_id FROM cloud_draft_operations WHERE created_at<now()-interval '8 days' ORDER BY owner_id LIMIT 50",UUID.class);
    }
    public void cleanOwner(UUID owner) {
        if(jdbc.queryForList("SELECT id FROM users WHERE id=? FOR UPDATE",UUID.class,owner).isEmpty()) return;
        expire(owner);
        jdbc.update("DELETE FROM cloud_draft_operations WHERE owner_id=? AND created_at<now()-interval '8 days'",owner);
    }
    private void expire(UUID owner) {
        for(var draft:jdbc.query("SELECT * FROM cloud_drafts WHERE owner_id=? AND state='ACTIVE' AND expires_at<=now()",ROW,owner)) {
            cancelReceipt(owner,draft);retire(owner,draft,"EXPIRED");
        }
        jdbc.update("DELETE FROM cloud_draft_revisions WHERE owner_id=? AND expires_at<=now()",owner);
    }
    private void cancelReceipt(UUID owner,Draft draft) {
        if(draft.pendingOperation()==null)return;
        cancelledSubmission(owner,draft.pendingOperation(),draft.pendingKind());
        if("COMPOSITION".equals(draft.pendingKind())) jdbc.update("INSERT INTO composition_receipts(owner_id,operation_id,cancelled) VALUES (?,?,true) ON CONFLICT(owner_id,operation_id) DO UPDATE SET cancelled=true WHERE composition_receipts.fingerprint IS NULL",owner,draft.pendingOperation());
        else jdbc.update("INSERT INTO submission_receipts(owner_id,operation_id,cancelled) VALUES (?,?,true) ON CONFLICT(owner_id,operation_id) DO NOTHING",owner,draft.pendingOperation());
    }
    private String submissionScope(Draft draft) {
        return draft.scope().equals("audio:compose") ? "compose" : draft.scope().replace("audio:correction-reference:","feedback:");
    }
    private List<Draft> pending(UUID owner,UUID operation,String kind) {return jdbc.query("SELECT * FROM cloud_drafts WHERE owner_id=? AND pending_operation=? AND pending_kind=? AND state='ACTIVE'",ROW,owner,operation,kind);}
    private List<Draft> allActive(UUID owner) {return jdbc.query("SELECT * FROM cloud_drafts WHERE owner_id=? AND state='ACTIVE' ORDER BY updated_at DESC,id LIMIT 50",ROW,owner);}
    private Draft find(UUID owner,UUID id) {return jdbc.query("SELECT * FROM cloud_drafts WHERE owner_id=? AND id=?",ROW,owner,id).stream().findFirst().orElse(null);}
    private Draft required(UUID owner,UUID id) {var result=find(owner,id);if(result==null)missing();return result;}
    private void lock(UUID owner) {if(jdbc.queryForList("SELECT id FROM users WHERE id=? FOR UPDATE",UUID.class,owner).isEmpty())missing();}
    private Settings requireEpoch(UUID owner,UUID epoch,boolean enabled) {var result=settings(owner);if(!Objects.equals(result.epoch(),epoch) || (enabled && !result.enabled())) conflict();return result;}
    private void active(Draft draft) {if(!"ACTIVE".equals(draft.state()))conflict();}
    private void editable(Draft draft,long version) {active(draft);if(draft.version()!=version || draft.pendingOperation()!=null)conflict();}
    private void retire(UUID owner,Draft draft,String state) {
        jdbc.update("UPDATE personal_exports SET state='EXPIRED',expires_at=now(),access_checks=NULL WHERE owner_id=? AND state='READY' AND jsonb_exists(access_checks->'cloudDrafts',?)",owner,draft.id().toString());
        jdbc.update("UPDATE cloud_drafts SET state=?,version=version+1,value=NULL,expires_at=NULL,pending_operation=NULL,pending_kind=NULL,pending_payload=NULL,updated_at=now() WHERE owner_id=? AND id=?",state,owner,draft.id());
        jdbc.update("DELETE FROM cloud_draft_revisions WHERE owner_id=? AND draft_id=?",owner,draft.id());
    }
    private void saveVersion(UUID owner,UUID id,long version,Map<String,Object> value,Instant edited) {
        String json=encode(value);
        jdbc.update("INSERT INTO cloud_draft_revisions(owner_id,draft_id,version,value,created_at,expires_at) VALUES (?,?,?,?::jsonb,?,?)",owner,id,version,json,java.sql.Timestamp.from(edited),java.sql.Timestamp.from(edited.plusSeconds(7*86400)));
        jdbc.update("DELETE FROM cloud_draft_revisions WHERE owner_id=? AND draft_id=? AND version NOT IN (SELECT version FROM cloud_draft_revisions WHERE owner_id=? AND draft_id=? ORDER BY version DESC LIMIT 20)",owner,id,owner,id);
        Long used=jdbc.queryForObject("SELECT coalesce(sum(octet_length(value::text)),0) FROM cloud_draft_revisions WHERE owner_id=?",Long.class,owner);
        if(used!=null && used>MAX_TEXT_BYTES)throw new ToneBridgeException(ErrorCode.PAYLOAD_TOO_LARGE);
        jdbc.update("UPDATE cloud_drafts SET value=?::jsonb,version=?,updated_at=?,expires_at=? WHERE owner_id=? AND id=?",json,version,java.sql.Timestamp.from(edited),java.sql.Timestamp.from(edited.plusSeconds(7*86400)),owner,id);
    }
    private Applied replay(UUID owner,UUID operation,String hash) {
        var rows=jdbc.queryForList("SELECT fingerprint,draft_id,applied_version FROM cloud_draft_operations WHERE owner_id=? AND operation_id=?",owner,operation);
        if(rows.isEmpty())return null;var row=rows.getFirst();if(!hash.equals(row.get("fingerprint")))conflict();
        return new Applied((UUID)row.get("draft_id"),((Number)row.get("applied_version")).longValue());
    }
    private void checkWriteRate(UUID owner) {
        var counts=jdbc.queryForMap("SELECT count(*) AS daily,count(*) FILTER(WHERE created_at>now()-interval '1 minute') AS recent FROM cloud_draft_operations WHERE owner_id=? AND created_at>now()-interval '1 day'",owner);
        if(((Number)counts.get("daily")).longValue()>=5000 || ((Number)counts.get("recent")).longValue()>=120)throw new ToneBridgeException(ErrorCode.TOO_MANY_REQUESTS);
    }
    private void remember(UUID owner,UUID operation,String hash,UUID id,long version) {jdbc.update("INSERT INTO cloud_draft_operations(owner_id,operation_id,fingerprint,draft_id,applied_version) VALUES (?,?,?,?,?)",owner,operation,hash,id,version);}
    private static String hash(Object value) {
        try {return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(encode(value).getBytes(StandardCharsets.UTF_8)));}
        catch(java.security.NoSuchAlgorithmException ex){throw new IllegalStateException(ex);}
    }
    private static String encode(Object value) {try{return JSON.writeValueAsString(value);}catch(java.io.IOException ex){throw new IllegalStateException("Draft encoding failed");}}
    @SuppressWarnings("unchecked") private static Map<String,Object> decode(String value) {if(value==null)return null;try{return JSON.readValue(value,Map.class);}catch(java.io.IOException ex){throw new IllegalStateException("Draft decoding failed");}}
    private static void conflict(){throw new ToneBridgeException(ErrorCode.CONFLICT);}
    private static void invalid(){throw new ToneBridgeException(ErrorCode.INVALID_INPUT);}
    private static void missing(){throw new ToneBridgeException(ErrorCode.RESOURCE_NOT_FOUND);}

    private static Instant editTime(Long millis) {
        long now=System.currentTimeMillis();
        if(millis==null || millis>now+300000)invalid();
        if(millis<now-7L*86400000)conflict();
        return Instant.ofEpochMilli(Math.min(millis,now));
    }
    private static void validate(String kind,String scope,Map<String,Object> value) {
        if(value==null || encode(value).getBytes(StandardCharsets.UTF_8).length>190000)throw new ToneBridgeException(ErrorCode.PAYLOAD_TOO_LARGE);
        String uuid="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
        Set<String> keys;
        switch(kind) {
            case "editor" -> {
                if(!scope.equals("compose") || !"TEXT".equals(value.get("kind")))invalid();
                keys=Set.of("kind","destination","selectedFriendId","targetLanguage","targetVariant","contentText","context","selectedGoals","step","sourceCardId");
                text(value,"selectedFriendId",100,false);text(value,"targetLanguage",50,false);text(value,"targetVariant",100,true);text(value,"sourceCardId",100,true);
                text(value,"contentText",10000,false);text(value,"context",10000,false);strings(value.get("selectedGoals"),6,50);integer(value.get("step"),0,2);
                if(!(value.get("destination") instanceof String destination) || !Set.of("PERSONAL","FRIEND","COMMUNITY").contains(destination))invalid();
            }
            case "feedback" -> {
                if(!scope.matches("feedback:"+uuid) || !"feedback".equals(value.get("kind")))invalid();
                keys=Set.of("kind","correctedText","explanation","selectedTags","timestampComments","pendingComment","pendingCategory","pronunciationScore","intonationScore","fluencyScore");
                for(String key:List.of("correctedText","explanation","pendingComment"))text(value,key,10000,false);
                text(value,"pendingCategory",100,false);strings(value.get("selectedTags"),20,100);
                for(String key:List.of("pronunciationScore","intonationScore","fluencyScore"))integer(value.get(key),1,10);
                if(!(value.get("timestampComments") instanceof List<?> comments) || comments.size()>200)invalid();
                else for(Object item:comments) {
                    if(!(item instanceof Map<?,?> comment) || !Set.of("id","start","end","comment","category").containsAll(comment.keySet()))invalid();
                    else {
                        for(String key:List.of("id","category","comment")) if(!(comment.get(key) instanceof String t) || t.length()>(key.equals("comment")?10000:100))invalid();
                        if(!(comment.get("start") instanceof Number start) || !(comment.get("end") instanceof Number end) || !Double.isFinite(start.doubleValue()) || !Double.isFinite(end.doubleValue()) || start.doubleValue()<0 || end.doubleValue()<start.doubleValue())invalid();
                    }
                }
            }
            case "card" -> {
                if(!scope.matches("card-new:"+uuid+"|card:"+uuid+":"+uuid) || !"card".equals(value.get("kind")))invalid();
                keys=Set.of("kind","sessionId","phrase","context","tags","tagText");
                text(value,"sessionId",100,false);text(value,"phrase",500,false);text(value,"context",10000,false);text(value,"tagText",2200,true);strings(value.get("tags"),20,100);
            }
            case "recording" -> {
                if(!scope.matches("audio:compose|audio:(practice|example|correction-reference):"+uuid))invalid();
                keys=Set.of("assetId","duration","editor","feedback");
                if(!(value.get("assetId") instanceof String asset) || !asset.matches(uuid))invalid();
                if(!(value.get("duration") instanceof Number duration) || !Double.isFinite(duration.doubleValue()) || duration.doubleValue()<0 || duration.doubleValue()>86400)invalid();
                if(value.containsKey("editor")) {
                    if(!scope.equals("audio:compose") || !(value.get("editor") instanceof Map<?,?>))invalid();
                    @SuppressWarnings("unchecked") var editor=new HashMap<>((Map<String,Object>)value.get("editor"));
                    if(!"AUDIO".equals(editor.get("kind")))invalid();editor.put("kind","TEXT");validate("editor","compose",editor);
                }
                if(value.containsKey("feedback")) {
                    if(!scope.startsWith("audio:correction-reference:") || !(value.get("feedback") instanceof Map<?,?>))invalid();
                    @SuppressWarnings("unchecked") var feedback=(Map<String,Object>)value.get("feedback");
                    validate("feedback",scope.replace("audio:correction-reference:","feedback:"),feedback);
                }
            }
            default -> {invalid();return;}
        }
        if(!keys.containsAll(value.keySet()))invalid();
    }
    private static void text(Map<String,Object> value,String key,int max,boolean nullable) {Object raw=value.get(key);if(raw==null && nullable)return;if(!(raw instanceof String s) || s.length()>max)invalid();}
    private static void strings(Object value,int count,int length) {if(!(value instanceof List<?> list) || list.size()>count || list.stream().anyMatch(v -> !(v instanceof String s) || s.length()>length))invalid();}
    private static void integer(Object value,int min,int max) {if(!(value instanceof Number n) || n.doubleValue()!=n.longValue() || n.longValue()<min || n.longValue()>max)invalid();}
}
