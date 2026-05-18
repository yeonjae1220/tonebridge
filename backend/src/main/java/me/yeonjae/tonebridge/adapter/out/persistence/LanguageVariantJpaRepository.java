package me.yeonjae.tonebridge.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LanguageVariantJpaRepository extends JpaRepository<LanguageVariantEntity, String> {

    List<LanguageVariantEntity> findByActiveTrueOrderByParentCodeAscLabelAsc();

    List<LanguageVariantEntity> findByParentCodeAndActiveTrue(String parentCode);

    Optional<LanguageVariantEntity> findByCodeAndActiveTrue(String code);
}
