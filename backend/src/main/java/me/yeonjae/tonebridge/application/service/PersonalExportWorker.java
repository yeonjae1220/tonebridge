package me.yeonjae.tonebridge.application.service;

import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.beans.factory.annotation.Value;
import me.yeonjae.tonebridge.application.port.out.PrivateFilePort;
import me.yeonjae.tonebridge.shared.exception.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.*;
import java.io.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.zip.*;

@Service
@RequiredArgsConstructor
public class PersonalExportWorker {
    public static final long MAX_ARCHIVE_BYTES=100L*1024*1024;
    private final PersonalExportJobs jobs;
    private final PersonalExportData data;
    private final PrivateFilePort files;
    private static final ObjectMapper JSON=new ObjectMapper();
    private final AtomicBoolean busy=new AtomicBoolean();
    private final ExecutorService executor=Executors.newSingleThreadExecutor(r -> { var thread=new Thread(r,"personal-export");thread.setDaemon(true);return thread; });
    @Value("${tonebridge.exports.scheduler-enabled:true}") private boolean enabled;
    @Scheduled(initialDelay=15000,fixedDelay=5000)
    public void tick() {
        if(!enabled || !busy.compareAndSet(false,true)) return;
        try { executor.execute(() -> { try { processOne(); cleanup(); } finally { busy.set(false); } }); }
        catch(RejectedExecutionException ex) { busy.set(false); }
    }
    @PreDestroy public void shutdown() { executor.shutdownNow(); }
    public static String key(UUID id) { return "private-exports/"+id+"/archive.zip"; }
    public void processOne() {
        var claimed=jobs.claim(); if(claimed.isEmpty()) return;
        var job=claimed.get(); Path temporary=null; boolean completed=false;
        try {
            var deadline=Instant.now().plusSeconds(300);
            var snapshot=data.snapshot(job.owner(),job.includeAudio());
            temporary=Files.createTempFile("tonebridge-export-",".zip");
            try(var zip=new ZipOutputStream(new BufferedOutputStream(Files.newOutputStream(temporary)))) {
                byte[] json=JSON.writerWithDefaultPrettyPrinter().writeValueAsBytes(snapshot.data());
                long consumed=json.length;
                write(zip,"records.json",json);
                write(zip,"README.txt",("ToneBridge personal export\nGenerated: "+Instant.now()+"\nRecords use explicit fields; no credentials or private peer account fields.\nAudio files include only recordings with server-recorded upload ownership. See audioOmitted and limitations in records.json.\nLocal-only browser drafts and unattributed shared notes/examples are excluded.\nThis archive is a snapshot; keep it private. Download availability expires after 24 hours.\n").getBytes(java.nio.charset.StandardCharsets.UTF_8));
                for(var audio:snapshot.audio()) {
                    if(Thread.currentThread().isInterrupted() || Instant.now().isAfter(deadline)) throw new IOException("Export deadline");
                    zip.putNextEntry(new ZipEntry(audio.entry()));
                    try(var input=files.open(audio.key(),50L*1024*1024)) {
                        byte[] buffer=new byte[64*1024]; int length;
                        while((length=input.read(buffer))!=-1) {
                            consumed+=length;
                            if(consumed>MAX_ARCHIVE_BYTES || Instant.now().isAfter(deadline)) throw new ToneBridgeException(ErrorCode.EXPORT_LIMIT);
                            zip.write(buffer,0,length);
                        }
                    }
                    zip.closeEntry();
                }
            }
            long size=Files.size(temporary);
            if(size>MAX_ARCHIVE_BYTES) throw new ToneBridgeException(ErrorCode.EXPORT_LIMIT);
            data.verify(job.owner(),snapshot.checks());
            if(Thread.currentThread().isInterrupted() || Instant.now().isAfter(deadline)) throw new IOException("Export deadline");
            files.put(key(job.id()),temporary,"application/zip");
            completed=jobs.complete(job,size,JSON.writeValueAsString(snapshot.checks()));
            if(!completed) files.delete(key(job.id()));
        } catch(Exception exception) {
            String reason=exception instanceof ToneBridgeException e ? e.getErrorCode().name() : "GENERATION_FAILED";
            jobs.fail(job.id(),reason);
            // Retained job metadata makes failed artifact cleanup retryable.
        } finally {
            try { if(!completed) jobs.needsCleanup(job.id()); }
            finally {
                if(temporary!=null) try { Files.deleteIfExists(temporary); } catch(IOException ignored) { /* private container temp; no content logged */ }
            }
        }
    }
    public void cleanup() {
        for(UUID id:jobs.cleanupCandidates()) {
            try { files.delete(key(id)); jobs.artifactDeleted(id); }
            catch(RuntimeException ignored) { /* Keep artifact_deleted=false for the next bounded cleanup pass. */ }
        }
    }
    private static void write(ZipOutputStream zip,String name,byte[] bytes) throws IOException {
        zip.putNextEntry(new ZipEntry(name));zip.write(bytes);zip.closeEntry();
    }
}
