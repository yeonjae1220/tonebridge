package me.yeonjae.tonebridge.adapter.in.web;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.service.*;
import me.yeonjae.tonebridge.shared.config.PasswordResetProperties;
import me.yeonjae.tonebridge.shared.security.*;
import me.yeonjae.tonebridge.shared.exception.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
@RestController @RequiredArgsConstructor
@RequestMapping("/api/auth/password-reset")
public class PasswordResetController {
    private final PasswordResetProperties properties;
    private final PasswordResetRateLimiter limits;
    private final ClientIpResolver ips;
    private final PasswordResetDelivery delivery;
    private final PasswordResetService reset;
    public record Request(@NotBlank @Email @Size(max=254) String email) {}
    public record Confirmation(
            @NotBlank @Pattern(regexp="[A-Za-z0-9_-]{43}") String token,
            @NotBlank @Pattern(regexp="^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&_#^()\\-])[A-Za-z\\d@$!%*?&_#^()\\-]{8,72}$") String password) {}
    @GetMapping("/status")
    public ResponseEntity<Map<String,Boolean>> status() {
        return ResponseEntity.ok().header("Cache-Control","no-store").body(Map.of("enabled",properties.isEnabled()));
    }
    @PostMapping
    public ResponseEntity<Void> request(@Valid @RequestBody Request input,HttpServletRequest request) {
        requireEnabled();
        if (limits.allowRequest(ips.resolve(request),input.email())) delivery.enqueue(input.email());
        // Identical for missing / Google / local accounts and email throttling.
        return ResponseEntity.accepted().header("Cache-Control","no-store").build();
    }
    @PostMapping("/confirm")
    public ResponseEntity<Void> confirm(@Valid @RequestBody Confirmation input,HttpServletRequest request) {
        requireEnabled();limits.checkConfirmation(ips.resolve(request));reset.confirm(input.token(),input.password());
        return ResponseEntity.noContent().header("Cache-Control","no-store").build();
    }
    private void requireEnabled() {
        if (!properties.isEnabled()) throw new ToneBridgeException(ErrorCode.PASSWORD_RESET_UNAVAILABLE);
    }
}
