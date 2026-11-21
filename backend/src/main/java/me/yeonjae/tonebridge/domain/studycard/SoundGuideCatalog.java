package me.yeonjae.tonebridge.domain.studycard;

import java.util.List;
import java.util.Set;

/**
 * Identifiers of the pronunciation guides a friend can point at in feedback. The guide content
 * (diagram, steps, translations) lives in the web client; the server only accepts these ids so
 * feedback can never store an arbitrary string. Keep in sync with
 * frontend/src/lib/soundGuideIds.json — a test fails when the two differ.
 */
public final class SoundGuideCatalog {

    public static final int MAX_TARGETS_PER_ATTEMPT = 3;

    public static final List<String> IDS = List.of("en-th", "en-r", "en-l", "ko-rieul");

    private static final Set<String> KNOWN = Set.copyOf(IDS);

    private SoundGuideCatalog() {
    }

    public static boolean isKnown(String guideId) {
        return guideId != null && KNOWN.contains(guideId);
    }
}
