package me.yeonjae.tonebridge.adapter.out.storage;

import lombok.RequiredArgsConstructor;
import me.yeonjae.tonebridge.application.port.out.PrivateFilePort;
import me.yeonjae.tonebridge.shared.config.ToneBridgeProperties;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.core.sync.RequestBody;
import java.io.*;
import java.nio.file.Path;
import java.time.Duration;

@Component
@RequiredArgsConstructor
public class MinioPrivateFileAdapter implements PrivateFilePort {
    private final S3Client s3;
    private final ToneBridgeProperties properties;
    public InputStream open(String key, long maximumBytes) {
        var stream=s3.getObject(request -> request.bucket(properties.getStorage().getBucket()).key(key)
                .overrideConfiguration(c -> c.apiCallTimeout(Duration.ofSeconds(60)).apiCallAttemptTimeout(Duration.ofSeconds(30))));
        if (stream.response().contentLength() == null || stream.response().contentLength() < 1 || stream.response().contentLength() > maximumBytes) {
            stream.abort(); throw new IllegalStateException("File size limit");
        }
        return new FilterInputStream(stream) {
            private long remaining=maximumBytes;
            @Override public int read() throws IOException { int value=super.read(); if(value>=0 && --remaining<0) throw new IOException("File size limit"); return value; }
            @Override public int read(byte[] bytes,int offset,int length) throws IOException {
                int count=in.read(bytes,offset,length); if(count>0 && (remaining-=count)<0) throw new IOException("File size limit"); return count;
            }
        };
    }
    public void put(String key, Path file, String contentType) {
        s3.putObject(request -> request.bucket(properties.getStorage().getBucket()).key(key).contentType(contentType).cacheControl("no-store")
                .overrideConfiguration(c -> c.apiCallTimeout(Duration.ofSeconds(120)).apiCallAttemptTimeout(Duration.ofSeconds(60))),RequestBody.fromFile(file));
    }
    public void delete(String key) {
        s3.deleteObject(request -> request.bucket(properties.getStorage().getBucket()).key(key)
                .overrideConfiguration(c -> c.apiCallTimeout(Duration.ofSeconds(20))));
    }
}
