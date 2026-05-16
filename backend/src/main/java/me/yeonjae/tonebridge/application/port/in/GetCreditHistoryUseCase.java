package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.domain.credit.CreditTransaction;

import java.util.List;
import java.util.UUID;

public interface GetCreditHistoryUseCase {
    List<CreditTransaction> getHistory(UUID userId);
}
