package me.yeonjae.tonebridge.application.port.out;

import me.yeonjae.tonebridge.domain.credit.CreditTransaction;

import java.util.List;
import java.util.UUID;

public interface CreditPort {
    void adjustCredits(UUID userId, int delta);
    CreditTransaction save(CreditTransaction tx);
    List<CreditTransaction> findHistoryByUserId(UUID userId);
}
