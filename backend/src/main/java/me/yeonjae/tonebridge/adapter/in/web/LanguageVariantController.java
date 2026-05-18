package me.yeonjae.tonebridge.adapter.in.web;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.adapter.in.web.dto.LanguageVariantResponse;
import me.yeonjae.tonebridge.application.port.in.GetLanguageVariantsUseCase;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/languages")
@RequiredArgsConstructor
public class LanguageVariantController {

    private final GetLanguageVariantsUseCase getLanguageVariantsUseCase;

    @GetMapping("/variants")
    public ResponseEntity<Map<String, List<LanguageVariantResponse>>> getVariants() {
        Map<String, List<LanguageVariantResponse>> result =
                getLanguageVariantsUseCase.getVariantsGroupedByLanguage()
                        .entrySet().stream()
                        .collect(Collectors.toMap(
                                Map.Entry::getKey,
                                e -> e.getValue().stream()
                                        .map(LanguageVariantResponse::from)
                                        .toList()
                        ));
        return ResponseEntity.ok(result);
    }
}
