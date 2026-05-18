package me.yeonjae.tonebridge.adapter.out.persistence;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "language_variants")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class LanguageVariantEntity {

    @Id
    private String code;

    @Column(nullable = false)
    private String parentCode;

    @Column(nullable = false)
    private String label;

    private String labelNative;

    @Column(nullable = false)
    private String variantType;

    private String region;

    @Column(nullable = false)
    private boolean active;
}
