package me.yeonjae.tonebridge.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LanguageVariantJpaRepository extends JpaRepository<LanguageVariantEntity, String> {

    List<LanguageVariantEntity> findByIsActiveTrueOrderByParentCodeAscLabelAsc();

    List<LanguageVariantEntity> findByParentCodeAndIsActiveTrue(String parentCode);

    Optional<LanguageVariantEntity> findByCodeAndIsActiveTrue(String code);
}
