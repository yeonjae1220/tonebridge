package me.yeonjae.tonebridge.application.port.in;

import me.yeonjae.tonebridge.application.port.out.PracticeFeedbackPort;
import java.util.List;
import java.util.UUID;

public interface GetPracticeFeedbackUseCase {
    record Page(List<PracticeFeedbackPort.Item> items, Integer nextPage) {}
    Page getFeedback(UUID userId, int page, int size);
}
