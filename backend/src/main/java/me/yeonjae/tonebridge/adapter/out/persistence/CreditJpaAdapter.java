package me.yeonjae.tonebridge.adapter.out.persistence;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.CreditPort;
import me.yeonjae.tonebridge.domain.credit.CreditTransaction;
import me.yeonjae.tonebridge.shared.exception.ErrorCode;
import me.yeonjae.tonebridge.shared.exception.ToneBridgeException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Transactional
public class CreditJpaAdapter implements CreditPort {

    private final UserJpaRepository userJpaRepository;
    private final CreditTransactionJpaRepository creditTransactionJpaRepository;

    @Override
    public void adjustCredits(UUID userId, int delta) {
        int updated = userJpaRepository.adjustCredits(userId, delta);
        if (updated == 0) {
            throw new ToneBridgeException(ErrorCode.INSUFFICIENT_CREDITS);
        }
    }

    @Override
    public CreditTransaction save(CreditTransaction tx) {
        return creditTransactionJpaRepository.save(CreditTransactionEntity.fromDomain(tx)).toDomain();
    }

    @Override
    @Transactional(readOnly = true)
    public List<CreditTransaction> findHistoryByUserId(UUID userId) {
        return creditTransactionJpaRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(CreditTransactionEntity::toDomain)
                .toList();
    }
}
