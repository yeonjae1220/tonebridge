package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.adapter.in.web.dto.FriendRequestResponse;
import me.yeonjae.tonebridge.adapter.in.web.dto.FriendResponse;
import me.yeonjae.tonebridge.application.port.in.AcceptFriendRequestUseCase;
import me.yeonjae.tonebridge.application.port.in.GetFriendsUseCase;
import me.yeonjae.tonebridge.application.port.in.SendFriendRequestUseCase;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/friends")
@Validated
@RequiredArgsConstructor
public class FriendController {

    private final SendFriendRequestUseCase sendUseCase;
    private final AcceptFriendRequestUseCase acceptUseCase;
    private final GetFriendsUseCase getUseCase;

    @PostMapping("/request")
    public ResponseEntity<FriendRequestResponse> sendRequest(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody SendRequestDto dto) {
        var result = sendUseCase.send(new SendFriendRequestUseCase.Command(userId, dto.receiverUsername()));
        return ResponseEntity.status(HttpStatus.CREATED).body(FriendRequestResponse.from(result));
    }

    @PostMapping("/{requestId}/accept")
    public ResponseEntity<FriendRequestResponse> accept(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID requestId) {
        var result = acceptUseCase.accept(new AcceptFriendRequestUseCase.Command(requestId, userId));
        return ResponseEntity.ok(FriendRequestResponse.from(result));
    }

    @GetMapping
    public ResponseEntity<List<FriendResponse>> getFriends(@AuthenticationPrincipal UUID userId) {
        var friends = getUseCase.getFriends(userId);
        return ResponseEntity.ok(friends.stream().map(FriendResponse::from).toList());
    }

    @GetMapping("/pending")
    public ResponseEntity<List<FriendRequestResponse>> getPending(@AuthenticationPrincipal UUID userId) {
        var pending = getUseCase.getPendingRequests(userId);
        return ResponseEntity.ok(pending.stream().map(FriendRequestResponse::fromPending).toList());
    }

    record SendRequestDto(@NotBlank String receiverUsername) {}
}
