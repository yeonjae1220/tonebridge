package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.in.GetCreditHistoryUseCase;
import me.yeonjae.tonebridge.application.port.out.CreditPort;
import me.yeonjae.tonebridge.domain.credit.CreditTransaction;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CreditService implements GetCreditHistoryUseCase {

    private final CreditPort creditPort;

    @Override
    public List<CreditTransaction> getHistory(UUID userId) {
        return creditPort.findHistoryByUserId(userId);
    }
}
