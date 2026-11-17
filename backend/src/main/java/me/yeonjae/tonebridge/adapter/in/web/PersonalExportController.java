package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.service.*;
import me.yeonjae.tonebridge.application.port.out.PrivateFilePort;
import me.yeonjae.tonebridge.shared.exception.*;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/users/me/exports")
@RequiredArgsConstructor
public class PersonalExportController {
    private final PersonalExportJobs jobs;
    private final PersonalExportData data;
    private final PrivateFilePort files;
    private static final ObjectMapper JSON=new ObjectMapper();
    record Create(@NotNull UUID operationId,boolean includeAudio) {}
    record View(UUID id,boolean includeAudio,String state,Instant createdAt,Instant expiresAt,Long byteSize,String failureCode) {
        static View of(PersonalExportJobs.Job job) {
            String state="READY".equals(job.state()) && !job.expiresAt().isAfter(Instant.now()) ? "EXPIRED" : job.state();
            return new View(job.id(),job.includeAudio(),state,job.createdAt(),job.expiresAt(),job.size(),job.failureCode());
        }
    }
    @PostMapping public ResponseEntity<View> create(@AuthenticationPrincipal UUID owner,@Valid @RequestBody Create input) {
        return ResponseEntity.accepted().cacheControl(CacheControl.noStore()).body(View.of(jobs.create(owner,input.operationId(),input.includeAudio())));
    }
    @GetMapping public ResponseEntity<List<View>> list(@AuthenticationPrincipal UUID owner) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(jobs.list(owner).stream().map(View::of).toList());
    }
    @GetMapping("/{id}") public ResponseEntity<View> status(@AuthenticationPrincipal UUID owner,@PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(View.of(jobs.get(owner,id)));
    }
    @GetMapping("/{id}/download") public ResponseEntity<InputStreamResource> download(@AuthenticationPrincipal UUID owner,@PathVariable UUID id) {
        var job=jobs.get(owner,id);
        if(!"READY".equals(job.state()) || job.checks()==null || job.expiresAt()==null || !job.expiresAt().isAfter(Instant.now())) throw new ToneBridgeException(ErrorCode.EXPORT_NOT_READY);
        try { data.verify(owner,JSON.readValue(job.checks(),new TypeReference<Map<String,List<String>>>(){})); }
        catch(java.io.IOException exception) { throw new ToneBridgeException(ErrorCode.EXPORT_NOT_READY); }
        jobs.download(owner,id);
        var stream=files.open(PersonalExportWorker.key(id),PersonalExportWorker.MAX_ARCHIVE_BYTES);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Content-Type-Options","nosniff")
                .header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=\"tonebridge-export-"+id+".zip\"")
                .contentType(MediaType.parseMediaType("application/zip")).contentLength(job.size()).body(new InputStreamResource(stream));
    }
}
