package me.yeonjae.tonebridge.application.port.out;

public interface AiFallbackPort {

    FallbackResult generateFallback(String originalText, String targetLanguage, String context);

    record FallbackResult(String correctedText, String explanation) {}
}
