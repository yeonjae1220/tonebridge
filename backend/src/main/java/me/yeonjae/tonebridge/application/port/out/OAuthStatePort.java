package me.yeonjae.tonebridge.application.port.out;

public interface OAuthStatePort {
    /** 무작위 state 값을 저장하고 반환 (TTL: 300초) */
    String generateAndSave();
    /** 저장된 state인지 확인 후 삭제 (one-time use) */
    boolean validateAndConsume(String state);
}
