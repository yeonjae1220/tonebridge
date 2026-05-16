package me.yeonjae.tonebridge.domain.credit;

import java.time.Instant;
import java.util.UUID;

public record CreditTransaction(
        UUID id,
        UUID userId,
        int amount,
        TransactionType type,
        UUID referenceId,
        String note,
        Instant createdAt
) {}
