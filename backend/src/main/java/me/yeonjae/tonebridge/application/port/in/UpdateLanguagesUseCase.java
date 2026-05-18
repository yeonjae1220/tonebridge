package me.yeonjae.tonebridge.application.port.in;

import java.util.List;
import java.util.UUID;

public interface UpdateLanguagesUseCase {
    record Command(
            UUID userId,
            String nativeLanguage,
            List<String> fluentLanguages,
            List<String> learningLanguages
    ) {}

    void update(Command command);
}
