package me.yeonjae.tonebridge.adapter.in.web;

import lombok.RequiredArgsConstructor;
import jakarta.validation.constraints.*;
import me.yeonjae.tonebridge.application.service.UserBlockService;
import me.yeonjae.tonebridge.application.port.out.UserBlockPort;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/users/me/blocks")
@RequiredArgsConstructor
@Validated
public class UserBlockController {
    private final UserBlockService blocks;
    record Page(List<UserBlockPort.Entry> items, Integer nextPage) {}
    @GetMapping public Page list(@AuthenticationPrincipal UUID owner, @RequestParam(defaultValue="0") @Min(0) @Max(10000) int page) {
        var rows=blocks.list(owner,page);
        return new Page(rows.stream().limit(50).toList(), rows.size()>50 ? page+1 : null);
    }
    @PutMapping("/{target}") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void block(@AuthenticationPrincipal UUID owner,@PathVariable UUID target) { blocks.block(owner,target); }
    @DeleteMapping("/{target}") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void unblock(@AuthenticationPrincipal UUID owner,@PathVariable UUID target) { blocks.unblock(owner,target); }
}
