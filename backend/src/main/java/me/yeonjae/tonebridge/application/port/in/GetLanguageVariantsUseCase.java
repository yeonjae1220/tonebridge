package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.application.port.out.LanguageVariantPort.LanguageVariantDto;

import java.util.List;
import java.util.Map;

public interface GetLanguageVariantsUseCase {
    Map<String, List<LanguageVariantDto>> getVariantsGroupedByLanguage();
}
