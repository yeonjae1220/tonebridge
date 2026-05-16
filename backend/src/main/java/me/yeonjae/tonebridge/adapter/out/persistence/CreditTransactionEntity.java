package me.yeonjae.tonebridge.adapter.out.persistence;

import jakarta.persistence.*;
import lombok.*;
import me.yeonjae.tonebridge.domain.credit.CreditTransaction;
import me.yeonjae.tonebridge.domain.credit.TransactionType;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "credit_transactions")
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreditTransactionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private int amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TransactionType type;

    private UUID referenceId;
    private String note;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }

    public CreditTransaction toDomain() {
        return new CreditTransaction(id, userId, amount, type, referenceId, note, createdAt);
    }

    public static CreditTransactionEntity fromDomain(CreditTransaction tx) {
        return CreditTransactionEntity.builder()
                .id(tx.id())
                .userId(tx.userId())
                .amount(tx.amount())
                .type(tx.type())
                .referenceId(tx.referenceId())
                .note(tx.note())
                .createdAt(tx.createdAt())
                .build();
    }
}
