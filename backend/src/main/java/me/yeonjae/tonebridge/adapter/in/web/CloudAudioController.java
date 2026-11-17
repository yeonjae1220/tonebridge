package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.service.CloudAudioFiles;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.io.IOException;
import java.util.UUID;

@RestController
@RequestMapping("/api/users/me/draft-audio")
@RequiredArgsConstructor
public class CloudAudioController {
    private final CloudAudioFiles files;
    @PutMapping("/{id}") public ResponseEntity<CloudAudioFiles.Info> reserve(@AuthenticationPrincipal UUID owner,@PathVariable UUID id,@Valid @RequestBody CloudAudioFiles.Reservation input){return response(files.reserve(owner,id,input));}
    @GetMapping("/{id}") public ResponseEntity<CloudAudioFiles.Info> status(@AuthenticationPrincipal UUID owner,@PathVariable UUID id){return response(files.info(owner,id));}
    @PutMapping("/{id}/file") public ResponseEntity<CloudAudioFiles.Info> upload(@AuthenticationPrincipal UUID owner,@PathVariable UUID id,HttpServletRequest request) throws IOException {
        return response(files.upload(owner,id,request.getInputStream(),request.getContentType(),request.getContentLengthLong()));
    }
    @GetMapping("/{id}/file") public ResponseEntity<InputStreamResource> download(@AuthenticationPrincipal UUID owner,@PathVariable UUID id) {
        var file=files.download(owner,id);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Content-Type-Options","nosniff")
                .contentType(MediaType.parseMediaType(file.info().contentType())).contentLength(file.info().byteSize()).body(new InputStreamResource(file.input()));
    }
    private static <T> ResponseEntity<T> response(T value){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(value);}
}
