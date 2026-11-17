package me.yeonjae.tonebridge.application.port.out;

import java.io.InputStream;
import java.nio.file.Path;

/** Server-only private objects. Keys are never accepted from export/download clients. */
public interface PrivateFilePort {
    InputStream open(String key, long maximumBytes);
    void put(String key, Path file, String contentType);
    void delete(String key);
}
