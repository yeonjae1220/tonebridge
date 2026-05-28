package me.yeonjae.tonebridge.application.port.in;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface UpdateLanguagesUseCase {
    record Command(
            UUID userId,
            String nativeLanguage,
            String uiLanguage,
            List<String> fluentLanguages,
            List<String> learningLanguages,
            String nativeDialect,
            Map<String, String> fluentLanguageVariants,
            Map<String, String> learningLanguageVariants
    ) {}

    void update(Command command);
}
