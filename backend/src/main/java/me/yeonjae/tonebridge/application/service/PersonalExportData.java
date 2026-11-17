package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import me.yeonjae.tonebridge.shared.exception.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.*;
import java.util.*;

/** Explicit field allowlists: entity serialization must never be used for a personal export. */
@Service
@RequiredArgsConstructor
public class PersonalExportData {
    public record Audio(String key,String entry) {}
    public record Snapshot(Map<String,Object> data,Map<String,List<String>> checks,List<Audio> audio) {}
    private final NamedParameterJdbcTemplate jdbc;
    private static final ObjectMapper JSON=new ObjectMapper();
    private static final String RECEIVED="""
        FROM corrections c JOIN correction_requests r ON r.id=c.request_id
        WHERE r.requester_id=:owner AND r.deleted_at IS NULL AND c.deleted_at IS NULL
        AND (c.corrector_id IS NULL OR c.corrector_id<>:owner)
        AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_id=:owner AND b.blocked_id=c.corrector_id)
           OR (b.blocked_id=:owner AND b.blocker_id=c.corrector_id))
        """;
    private static final String FEEDBACK="""
        FROM learner_attempts a JOIN study_cards c ON c.id=a.card_id JOIN study_sessions s ON s.id=c.session_id
        WHERE a.learner_id=:owner AND a.correction_note IS NOT NULL AND c.deleted_at IS NULL AND s.deleted_at IS NULL
        AND EXISTS(SELECT 1 FROM session_members m WHERE m.session_id=s.id AND m.user_id=:owner)
        AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_id=:owner AND b.blocked_id=a.correction_author_id)
           OR (b.blocked_id=:owner AND b.blocker_id=a.correction_author_id))
        """;
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Snapshot snapshot(UUID owner,boolean includeAudio) {
        var budget=new Budget();
        Map<String,Object> data=new LinkedHashMap<>();
        Map<String,List<String>> checks=new LinkedHashMap<>();
        data.put("formatVersion",1); data.put("generatedAt",java.time.Instant.now().toString());
        var profile=rows("SELECT id,email,username,native_language,ui_language,fluent_languages,learning_languages,native_dialect,fluent_lang_variants,learning_lang_variants,reputation_score,corrector_level,correction_streak,created_at FROM users WHERE id=:owner",owner,budget);
        if(profile.isEmpty()) throw new ToneBridgeException(ErrorCode.USER_NOT_FOUND);
        data.put("profile",profile);
        data.put("requests",rows("SELECT id,type,content_text,target_language,target_variant,context,feedback_goals,status,created_at,audio_url AS _audio FROM correction_requests WHERE requester_id=:owner AND deleted_at IS NULL",owner,budget));
        data.put("writtenCorrections",rows("SELECT c.id,c.request_id,c.corrected_text,c.explanation,c.tags,c.timestamp_comments,c.pronunciation_score,c.intonation_score,c.fluency_score,c.status,c.created_at,c.reference_audio_url AS _audio FROM corrections c JOIN correction_requests r ON r.id=c.request_id WHERE c.corrector_id=:owner AND c.deleted_at IS NULL AND r.deleted_at IS NULL",owner,budget));
        data.put("cards",rows("SELECT id,session_id,phrase,context,tags,created_at,native_audio_url AS _audio FROM study_cards WHERE created_by_user_id=:owner AND deleted_at IS NULL",owner,budget));
        data.put("notebooksCreatedByMe",rows("SELECT id,title,created_at FROM study_sessions WHERE created_by=:owner AND deleted_at IS NULL",owner,budget));
        data.put("practiceAttempts",rows("SELECT id,card_id,attempted_at,audio_url AS _audio FROM learner_attempts WHERE learner_id=:owner",owner,budget));
        data.put("ratings",rows("SELECT id,correction_id,helpful,created_at FROM ratings WHERE rater_id=:owner",owner,budget));
        data.put("likes",rows("SELECT id,correction_id,created_at FROM correction_likes WHERE user_id=:owner",owner,budget));
        var received=rows("SELECT c.id,c.request_id,c.corrected_text,c.explanation,c.tags,c.timestamp_comments,c.pronunciation_score,c.intonation_score,c.fluency_score,c.status,c.created_at "+RECEIVED,owner,budget);
        data.put("receivedCorrections",received); checks.put("receivedCorrections",ids(received));
        var feedback=rows("SELECT a.id,a.card_id,a.correction_note,a.score,a.correction_updated_at "+FEEDBACK,owner,budget);
        data.put("receivedPracticeFeedback",feedback); checks.put("receivedPracticeFeedback",ids(feedback));
        var cloud=rows("SELECT id,kind,scope,version,value,updated_at,expires_at,pending_operation,pending_kind FROM cloud_drafts WHERE owner_id=:owner AND state='ACTIVE' AND expires_at>now()",owner,budget);
        data.put("cloudDrafts",cloud);checks.put("cloudDrafts",ids(cloud));
        var revisions=rows("SELECT r.draft_id::text || ':' || r.version::text AS id,r.draft_id,r.version,r.value,r.created_at,r.expires_at FROM cloud_draft_revisions r JOIN cloud_drafts d ON d.owner_id=r.owner_id AND d.id=r.draft_id WHERE r.owner_id=:owner AND d.state='ACTIVE' AND d.expires_at>now() AND r.expires_at>now()",owner,budget);
        data.put("cloudDraftHistory",revisions);checks.put("cloudDraftHistory",ids(revisions));
        // Pending operation identity is portable, but its transport payload may contain
        // raw storage keys. Export only the explicitly allowed editor value above.
        // Ownership is proven by a server-generated upload registration or committed composition receipt.
        data.put("ownedExampleAudio",rows("""
            SELECT n.id,n.card_id,n.created_at,n.audio_key AS _audio FROM card_native_audio n
            WHERE EXISTS(SELECT 1 FROM audio_upload_owners u WHERE u.audio_key=n.audio_key AND u.owner_id=:owner)
               OR EXISTS(SELECT 1 FROM composition_receipts p WHERE p.audio_key=n.audio_key AND p.owner_id=:owner AND p.fingerprint IS NOT NULL)
            """,owner,budget));
        var cloudFiles=jdbc.queryForList("SELECT id::text,object_key FROM cloud_audio_assets WHERE owner_id=:owner AND state='READY'",Map.of("owner",owner));
        Map<String,String> cloudKeys=new HashMap<>();
        for(var file:cloudFiles)cloudKeys.put((String)file.get("id"),(String)file.get("object_key"));
        for(var row:java.util.stream.Stream.concat(cloud.stream(),revisions.stream()).toList()) {
            if(row.get("value") instanceof Map<?,?> value && value.get("assetId") instanceof String id && cloudKeys.containsKey(id))row.put("_audio",cloudKeys.get(id));
        }
        var candidates=new LinkedHashSet<String>();
        for(Object section:data.values()) if(section instanceof List<?> list) for(Object item:list) {
            if(item instanceof Map<?,?> row && row.get("_audio") instanceof String key) candidates.add(key);
        }
        Set<String> owned=Set.of();
        if(!candidates.isEmpty()) owned=new HashSet<>(jdbc.queryForList("""
            SELECT audio_key FROM audio_upload_owners WHERE owner_id=:owner AND audio_key IN (:keys)
            UNION SELECT audio_key FROM composition_receipts WHERE owner_id=:owner AND fingerprint IS NOT NULL AND audio_key IN (:keys)
            UNION SELECT object_key FROM cloud_audio_assets WHERE owner_id=:owner AND state='READY' AND object_key IN (:keys)
            """,Map.of("owner",owner,"keys",candidates),String.class));
        Map<String,String> entries=new LinkedHashMap<>();
        int omitted=0;
        for(Object section:data.values()) if(section instanceof List<?> list) for(Object item:list) {
            @SuppressWarnings("unchecked") var row=(Map<String,Object>)item;
            Object raw=row.remove("_audio");
            if(raw instanceof String key && !key.isBlank()) {
                if(includeAudio && owned.contains(key)) {
                    String entry=entries.computeIfAbsent(key,k -> "audio/"+(entries.size()+1)+extension(k));
                    row.put("audioFile",entry);
                } else { row.put("audioOmitted",includeAudio ? "ownership_not_recorded" : "not_requested"); omitted++; }
            }
        }
        data.put("omittedAudioReferences",omitted);
        data.put("limitations",List.of("Local-only browser drafts are not on the server.","Shared card/example notes have no reliable author metadata and are excluded.","Legacy example audio without recorded upload ownership is excluded.","Received feedback contains no peer email or authentication data."));
        return new Snapshot(data,checks,entries.entrySet().stream().map(e -> new Audio(e.getKey(),e.getValue())).toList());
    }
    @Transactional(readOnly=true)
    public void verify(UUID owner,Map<String,List<String>> checks) {
        if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM users WHERE id=:owner)",Map.of("owner",owner),Boolean.class))) throw new ToneBridgeException(ErrorCode.RESOURCE_NOT_FOUND);
        verifyIds(owner,checks.getOrDefault("cloudDrafts",List.of()),"SELECT id::text FROM cloud_drafts WHERE owner_id=:owner AND state='ACTIVE' AND expires_at>now() AND id IN (:ids)");
        var history=checks.getOrDefault("cloudDraftHistory",List.of());
        if(!history.isEmpty()) {
            var allowed=new HashSet<>(jdbc.queryForList("SELECT r.draft_id::text || ':' || r.version::text FROM cloud_draft_revisions r JOIN cloud_drafts d ON d.owner_id=r.owner_id AND d.id=r.draft_id WHERE r.owner_id=:owner AND d.state='ACTIVE' AND d.expires_at>now() AND r.expires_at>now() AND (r.draft_id::text || ':' || r.version::text) IN (:ids)",Map.of("owner",owner,"ids",history),String.class));
            if(!allowed.containsAll(history))throw new ToneBridgeException(ErrorCode.EXPORT_ACCESS_CHANGED);
        }
        verifyIds(owner,checks.getOrDefault("receivedCorrections",List.of()),"SELECT c.id::text "+RECEIVED+" AND c.id IN (:ids)");
        verifyIds(owner,checks.getOrDefault("receivedPracticeFeedback",List.of()),"SELECT a.id::text "+FEEDBACK+" AND a.id IN (:ids)");
    }
    private void verifyIds(UUID owner,List<String> ids,String sql) {
        if(ids.isEmpty()) return;
        var requested=ids.stream().map(UUID::fromString).toList();
        var allowed=new HashSet<>(jdbc.queryForList(sql,Map.of("owner",owner,"ids",requested),String.class));
        if(!allowed.containsAll(ids)) throw new ToneBridgeException(ErrorCode.EXPORT_ACCESS_CHANGED);
    }

    private static List<String> ids(List<Map<String,Object>> rows) { return rows.stream().map(row -> row.get("id").toString()).toList(); }
    private static class Budget { long bytes; int rows; }
    private List<Map<String,Object>> rows(String sql,UUID owner,Budget budget) {
        List<Map<String,Object>> rows=new ArrayList<>();
        jdbc.query(sql+" LIMIT 10001",Map.of("owner",owner),(org.springframework.jdbc.core.RowCallbackHandler) rs -> {
            if(++budget.rows>10000) throw new ToneBridgeException(ErrorCode.EXPORT_LIMIT);
            var row=new LinkedHashMap<String,Object>();
            var meta=rs.getMetaData();
            for(int col=1;col<=meta.getColumnCount();col++) {
                Object value=rs.getObject(col);
                if(value!=null && Set.of("json","jsonb").contains(meta.getColumnTypeName(col))) {
                    try { value=JSON.readValue(value.toString(),Object.class); }
                    catch(java.io.IOException ex) { throw new IllegalStateException("Export JSON decoding failed"); }
                } else if(value instanceof java.sql.Array array) value=Arrays.asList((Object[])array.getArray());
                else if(value instanceof Timestamp timestamp) value=timestamp.toInstant().toString();
                else if(value instanceof UUID) value=value.toString();
                else if(value!=null && !(value instanceof String || value instanceof Number || value instanceof Boolean || value instanceof Map || value instanceof List)) value=value.toString();
                row.put(meta.getColumnLabel(col),value);
            }
            try { budget.bytes+=JSON.writeValueAsBytes(row).length; }
            catch(java.io.IOException ex) { throw new IllegalStateException("Export encoding failed"); }
            if(budget.bytes>25L*1024*1024) throw new ToneBridgeException(ErrorCode.EXPORT_LIMIT);
            rows.add(row);
        });
        return rows;
    }
    private static String extension(String key) {
        int index=key.lastIndexOf('.'); String ext=index<0 ? "" : key.substring(index).toLowerCase(Locale.ROOT);
        return Set.of(".webm",".m4a",".mp4",".mp3",".wav",".ogg",".aac",".3gp").contains(ext) ? ext : ".audio";
    }
}
