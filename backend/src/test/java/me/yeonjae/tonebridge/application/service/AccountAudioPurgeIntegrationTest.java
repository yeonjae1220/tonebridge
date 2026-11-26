package me.yeonjae.tonebridge.application.service;

import me.yeonjae.tonebridge.application.port.in.DeleteCurrentUserUseCase;
import me.yeonjae.tonebridge.application.port.out.StoragePort;
import me.yeonjae.tonebridge.support.PostgresIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * The privacy policy promises that deleting an account deletes the user's recordings. Database rows
 * cascade away, but the audio objects live in storage and must be found and removed separately.
 */
class AccountAudioPurgeIntegrationTest extends PostgresIntegrationTest {

    @Autowired JdbcTemplate jdbc;
    @Autowired DeleteCurrentUserUseCase deleteUser;
    @Autowired AccountAudioPurge purge;
    @MockitoBean StoragePort storage;

    UUID leaving;
    UUID friend;
    UUID friendCard;
    UUID correction;

    String exampleOnOwnNotebook;
    String friendAttemptInOwnNotebook;
    String exampleOnFriendCard;
    String friendOwnExample;
    String attemptOnFriendCard;
    String legacyCorrectionAudio;
    String legacyRequestAudio;
    String friendRequestAudio;

    @BeforeEach
    void seed() {
        jdbc.update("DELETE FROM account_audio_deletions");
        leaving = user();
        friend = user();

        // The leaving user's notebook, holding a friend's card with both users' recordings.
        UUID ownNotebook = session(leaving);
        UUID cardInOwnNotebook = card(ownNotebook, friend);
        exampleOnOwnNotebook = nativeAudio(cardInOwnNotebook, leaving);
        friendAttemptInOwnNotebook = attempt(cardInOwnNotebook, friend);

        // The friend's notebook: the leaving user added an example voice and practised on it.
        UUID friendNotebook = session(friend);
        friendCard = card(friendNotebook, friend);
        exampleOnFriendCard = nativeAudio(friendCard, leaving);
        friendOwnExample = nativeAudio(friendCard, friend);
        attemptOnFriendCard = attempt(friendCard, leaving);

        // Older community data written before uploads recorded an owner.
        UUID friendRequest = UUID.randomUUID();
        friendRequestAudio = key(friend);
        jdbc.update("INSERT INTO correction_requests(id,requester_id,type,target_language,content_text,status,credit_cost,audio_url)"
                + " VALUES (?,?,'AUDIO','en','Hi','PENDING',0,?)", friendRequest, friend, friendRequestAudio);
        correction = UUID.randomUUID();
        legacyCorrectionAudio = key(leaving);
        jdbc.update("INSERT INTO corrections(id,request_id,corrector_id,corrected_text,explanation,reference_audio_url)"
                + " VALUES (?,?,?,'Hi there','Natural',?)", correction, friendRequest, leaving, legacyCorrectionAudio);
        legacyRequestAudio = key(leaving);
        jdbc.update("INSERT INTO correction_requests(id,requester_id,type,target_language,content_text,status,credit_cost,audio_url)"
                + " VALUES (?,?,'AUDIO','en','Hello','PENDING',0,?)", UUID.randomUUID(), leaving, legacyRequestAudio);
    }

    @Test
    void deletingAnAccountQueuesEveryRecordingItLeavesBehindAndNothingElse() {
        deleteUser.delete(leaving);

        assertThat(queued()).containsExactlyInAnyOrder(
                exampleOnOwnNotebook, friendAttemptInOwnNotebook, exampleOnFriendCard,
                attemptOnFriendCard, legacyCorrectionAudio, legacyRequestAudio);
    }

    @Test
    void theLeavingUsersVoiceIsDetachedFromRecordsThatStay() {
        deleteUser.delete(leaving);

        assertThat(jdbc.queryForList("SELECT audio_key FROM card_native_audio WHERE card_id=?", String.class, friendCard))
                .containsExactly(friendOwnExample);
        assertThat(jdbc.queryForObject("SELECT reference_audio_url FROM corrections WHERE id=?", String.class, correction))
                .isNull();
        assertThat(jdbc.queryForObject("SELECT corrected_text FROM corrections WHERE id=?", String.class, correction))
                .isEqualTo("Hi there");
    }

    @Test
    void theWorkerDeletesQueuedObjectsAndForgetsThem() {
        deleteUser.delete(leaving);

        purge.deleteQueued();

        for (String key : List.of(exampleOnOwnNotebook, friendAttemptInOwnNotebook, exampleOnFriendCard,
                attemptOnFriendCard, legacyCorrectionAudio, legacyRequestAudio)) {
            verify(storage).deleteObject(key);
        }
        verify(storage, never()).deleteObject(friendOwnExample);
        verify(storage, never()).deleteObject(friendRequestAudio);
        assertThat(queued()).isEmpty();
    }

    @Test
    void aStorageFailureKeepsTheKeyForALaterRetry() {
        deleteUser.delete(leaving);
        doThrow(new IllegalStateException("storage down")).when(storage).deleteObject(anyString());

        purge.deleteQueued();

        assertThat(queued()).hasSize(6);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM account_audio_deletions WHERE attempts=1 AND next_attempt_at>now()",
                Integer.class)).isEqualTo(6);
    }

    private List<String> queued() {
        return jdbc.queryForList("SELECT audio_key FROM account_audio_deletions", String.class);
    }

    private UUID user() {
        UUID id = UUID.randomUUID();
        String name = "u" + id.toString().substring(0, 12);
        jdbc.update("INSERT INTO users(id,email,username,native_language) VALUES (?,?,?,'ko')",
                id, name + "@example.test", name);
        return id;
    }

    private UUID session(UUID owner) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO study_sessions(id,created_by,title) VALUES (?,?,'Notebook')", id, owner);
        jdbc.update("INSERT INTO session_members(session_id,user_id) VALUES (?,?)", id, owner);
        return id;
    }

    private UUID card(UUID session, UUID author) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO study_cards(id,session_id,created_by_user_id,phrase,tags) VALUES (?,?,?,'Hello','')",
                id, session, author);
        return id;
    }

    private String nativeAudio(UUID card, UUID uploader) {
        String key = ownedKey(uploader);
        jdbc.update("INSERT INTO card_native_audio(card_id,audio_key) VALUES (?,?)", card, key);
        return key;
    }

    private String attempt(UUID card, UUID learner) {
        String key = ownedKey(learner);
        jdbc.update("INSERT INTO learner_attempts(card_id,learner_id,audio_url) VALUES (?,?,?)", card, learner, key);
        return key;
    }

    private String ownedKey(UUID owner) {
        String key = key(owner);
        jdbc.update("INSERT INTO audio_upload_owners(audio_key,owner_id) VALUES (?,?)", key, owner);
        return key;
    }

    private static String key(UUID owner) {
        return "audio/" + UUID.randomUUID() + "/" + owner.toString().substring(0, 8) + ".m4a";
    }
}
