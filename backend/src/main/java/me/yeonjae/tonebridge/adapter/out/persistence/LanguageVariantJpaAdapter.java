package me.yeonjae.tonebridge.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.LanguageVariantPort;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class LanguageVariantJpaAdapter implements LanguageVariantPort {

    private final LanguageVariantJpaRepository repository;

    @Override
    public List<LanguageVariantDto> findAllActive() {
        return repository.findByActiveTrueOrderByParentCodeAscLabelAsc()
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Override
    public Map<String, List<LanguageVariantDto>> findAllActiveGroupedByParent() {
        return findAllActive().stream()
                .collect(Collectors.groupingBy(LanguageVariantDto::parentCode));
    }

    @Override
    public Optional<LanguageVariantDto> findActiveByCode(String code) {
        return repository.findByCodeAndActiveTrue(code).map(this::toDto);
    }

    private LanguageVariantDto toDto(LanguageVariantEntity e) {
        return new LanguageVariantDto(
                e.getCode(), e.getParentCode(), e.getLabel(),
                e.getLabelNative(), e.getVariantType(), e.getRegion()
        );
    }
}
