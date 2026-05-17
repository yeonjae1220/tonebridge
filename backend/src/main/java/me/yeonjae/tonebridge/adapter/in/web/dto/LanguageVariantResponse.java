package me.yeonjae.tonebridge.adapter.in.web.dto;

import me.yeonjae.tonebridge.application.port.out.LanguageVariantPort.LanguageVariantDto;

public record LanguageVariantResponse(
        String code,
        String parentCode,
        String label,
        String labelNative,
        String variantType,
        String region
) {
    public static LanguageVariantResponse from(LanguageVariantDto dto) {
        return new LanguageVariantResponse(
                dto.code(), dto.parentCode(), dto.label(),
                dto.labelNative(), dto.variantType(), dto.region()
        );
    }
}
