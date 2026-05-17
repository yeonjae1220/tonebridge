package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.in.GetLanguageVariantsUseCase;
import me.yeonjae.tonebridge.application.port.out.LanguageVariantPort;
import me.yeonjae.tonebridge.application.port.out.LanguageVariantPort.LanguageVariantDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class LanguageVariantService implements GetLanguageVariantsUseCase {

    private final LanguageVariantPort languageVariantPort;

    @Override
    public Map<String, List<LanguageVariantDto>> getVariantsGroupedByLanguage() {
        return languageVariantPort.findAllActiveGroupedByParent();
    }
}
