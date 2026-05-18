package me.yeonjae.tonebridge.application.port.out;

import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface LanguageVariantPort {

    record LanguageVariantDto(
            String code,
            String parentCode,
            String label,
            String labelNative,
            String variantType,
            String region
    ) {}

    List<LanguageVariantDto> findAllActive();

    Map<String, List<LanguageVariantDto>> findAllActiveGroupedByParent();

    Optional<LanguageVariantDto> findActiveByCode(String code);
}
