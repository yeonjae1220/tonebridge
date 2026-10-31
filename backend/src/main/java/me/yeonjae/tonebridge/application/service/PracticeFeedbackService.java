package me.yeonjae.tonebridge.application.service;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.in.GetPracticeFeedbackUseCase;
import me.yeonjae.tonebridge.application.port.out.PracticeFeedbackPort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PracticeFeedbackService implements GetPracticeFeedbackUseCase {
    private final PracticeFeedbackPort feedbackPort;

    @Override
    public Page getFeedback(UUID userId, int page, int size) {
        if (page < 0 || page > 10000 || size < 1 || size > 50) throw new IllegalArgumentException("Invalid page");
        var rows = feedbackPort.findForLearner(userId, page * size, size + 1);
        return new Page(rows.stream().limit(size).toList(), rows.size() > size ? page + 1 : null);
    }
}
