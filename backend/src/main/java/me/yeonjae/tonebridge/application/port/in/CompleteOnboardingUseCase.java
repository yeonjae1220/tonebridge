package me.yeonjae.tonebridge.application.port.in;

import java.util.List;
import java.util.UUID;

public interface CompleteOnboardingUseCase {
    record Command(
            UUID userId,
            String nativeLanguage,
            List<String> fluentLanguages,
            List<String> learningLanguages
    ) {}

    void complete(Command command);
}
