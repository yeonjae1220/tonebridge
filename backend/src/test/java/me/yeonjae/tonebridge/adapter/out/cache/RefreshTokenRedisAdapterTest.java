package me.yeonjae.tonebridge.adapter.out.cache;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("RefreshTokenRedisAdapter — 평문 대신 SHA-256 해시로 저장/조회한다")
class RefreshTokenRedisAdapterTest {

    private static final String RAW_TOKEN = "raw-refresh-token-value";
    private static final String TOKEN_HASH = sha256Hex(RAW_TOKEN);

    @Mock private RedisTemplate<String, String> redisTemplate;
    @Mock private ValueOperations<String, String> valueOperations;
    @Mock private SetOperations<String, String> setOperations;

    private RefreshTokenRedisAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new RefreshTokenRedisAdapter(redisTemplate);
    }

    @Test
    @DisplayName("save: Redis에 평문 토큰이 아닌 해시값을 키/멤버로 저장한다")
    void save_storesHashNotPlainToken() {
        UUID userId = UUID.randomUUID();
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(redisTemplate.opsForSet()).thenReturn(setOperations);

        adapter.save(RAW_TOKEN, userId, 3600L);

        verify(valueOperations).set(eq("refresh:" + TOKEN_HASH), eq(userId.toString()), eq(Duration.ofSeconds(3600L)));
        verify(setOperations).add("user_tokens:" + userId, TOKEN_HASH);
        verify(valueOperations, never()).set(argThat(key -> key.contains(RAW_TOKEN)), anyString(), any());
    }

    @Test
    @DisplayName("findUserIdByToken: 평문 토큰을 해시한 키로 조회한다")
    void findUserIdByToken_looksUpByHash() {
        UUID userId = UUID.randomUUID();
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("refresh:" + TOKEN_HASH)).thenReturn(userId.toString());

        Optional<UUID> result = adapter.findUserIdByToken(RAW_TOKEN);

        assertThat(result).contains(userId);
        verify(valueOperations, never()).get("refresh:" + RAW_TOKEN);
    }

    @Test
    @DisplayName("delete: 해시 기반 키를 삭제하고 사용자 토큰 집합에서도 해시값을 제거한다")
    void delete_removesHashedKeyAndSetMember() {
        UUID userId = UUID.randomUUID();
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        when(valueOperations.get("refresh:" + TOKEN_HASH)).thenReturn(userId.toString());

        adapter.delete(RAW_TOKEN);

        verify(redisTemplate).delete("refresh:" + TOKEN_HASH);
        verify(setOperations).remove("user_tokens:" + userId, TOKEN_HASH);
    }

    @Test
    @DisplayName("deleteAllByUserId: 저장된 해시 멤버들로 refresh 키 목록을 구성해 삭제한다")
    void deleteAllByUserId_buildsKeysFromStoredHashes() {
        UUID userId = UUID.randomUUID();
        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        when(setOperations.members("user_tokens:" + userId)).thenReturn(Set.of(TOKEN_HASH));

        adapter.deleteAllByUserId(userId);

        verify(redisTemplate).delete(java.util.List.of("refresh:" + TOKEN_HASH));
        verify(redisTemplate).delete("user_tokens:" + userId);
    }

    private static String sha256Hex(String value) {
        try {
            var digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(hashed);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
