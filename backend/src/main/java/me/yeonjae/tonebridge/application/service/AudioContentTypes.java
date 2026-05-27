package me.yeonjae.tonebridge.application.service;

final class AudioContentTypes {

    private AudioContentTypes() {
    }

    static String fromFileName(String fileName) {
        String lower = fileName == null ? "" : fileName.toLowerCase();
        if (lower.endsWith(".webm")) return "audio/webm";
        if (lower.endsWith(".m4a") || lower.endsWith(".mp4")) return "audio/mp4";
        if (lower.endsWith(".ogg") || lower.endsWith(".opus")) return "audio/ogg";
        if (lower.endsWith(".wav")) return "audio/wav";
        if (lower.endsWith(".mp3") || lower.endsWith(".mpeg")) return "audio/mpeg";
        if (lower.endsWith(".3gp") || lower.endsWith(".3gpp")) return "audio/3gpp";
        return "audio/aac";
    }
}
