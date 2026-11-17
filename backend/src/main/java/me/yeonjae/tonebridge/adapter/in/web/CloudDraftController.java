package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.service.CloudDraftService;
import me.yeonjae.tonebridge.application.service.CloudDraftService.*;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/users/me/drafts")
@RequiredArgsConstructor
public class CloudDraftController {
    private final CloudDraftService drafts;
    private static <T> ResponseEntity<T> privateResponse(T body) {return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);}
    @GetMapping("/settings") public ResponseEntity<Settings> settings(@AuthenticationPrincipal UUID owner) {return privateResponse(drafts.settings(owner));}
    @PutMapping("/settings") public ResponseEntity<Settings> preferences(@AuthenticationPrincipal UUID owner,@Valid @RequestBody Preferences input) {return privateResponse(drafts.preferences(owner,input));}
    @GetMapping("/operations/{operation}") public ResponseEntity<Applied> operation(@AuthenticationPrincipal UUID owner,@PathVariable UUID operation) {return privateResponse(drafts.operation(owner,operation));}
    @GetMapping public ResponseEntity<List<Draft>> list(@AuthenticationPrincipal UUID owner) {return privateResponse(drafts.list(owner));}
    @GetMapping("/{id}") public ResponseEntity<Draft> get(@AuthenticationPrincipal UUID owner,@PathVariable UUID id) {return privateResponse(drafts.get(owner,id));}
    @PutMapping("/{id}") public ResponseEntity<Applied> write(@AuthenticationPrincipal UUID owner,@PathVariable UUID id,@Valid @RequestBody Write input) {return privateResponse(drafts.write(owner,id,input));}
    @PostMapping("/{id}/delete") public ResponseEntity<Applied> delete(@AuthenticationPrincipal UUID owner,@PathVariable UUID id,@Valid @RequestBody Change input) {return privateResponse(drafts.delete(owner,id,input));}
    @GetMapping("/{id}/history") public ResponseEntity<List<Revision>> history(@AuthenticationPrincipal UUID owner,@PathVariable UUID id) {return privateResponse(drafts.history(owner,id));}
    @PostMapping("/{id}/history/{revision}/restore") public ResponseEntity<Applied> restore(@AuthenticationPrincipal UUID owner,@PathVariable UUID id,@PathVariable long revision,@Valid @RequestBody Change input) {return privateResponse(drafts.restore(owner,id,revision,input));}
    @PostMapping("/{id}/prepare-submission") public ResponseEntity<Draft> prepare(@AuthenticationPrincipal UUID owner,@PathVariable UUID id,@Valid @RequestBody Prepare input) {return privateResponse(drafts.prepare(owner,id,input));}
}
