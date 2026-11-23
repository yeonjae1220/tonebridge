package me.yeonjae.tonebridge.domain.studycard;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SoundGuideCatalogTest {

    /** The web client renders guides by these ids; a guide added on one side only must fail the build. */
    @Test
    void serverAllowListMatchesTheIdsTheWebClientRenders() throws Exception {
        Path shared = Path.of("..", "frontend", "src", "lib", "soundGuides.json");
        var guides = JsonMapper.builder().build().readTree(Files.readString(shared)).get("guides");
        List<String> webIds = new java.util.ArrayList<>();
        guides.forEach(guide -> webIds.add(guide.get("id").asText()));

        assertThat(webIds).containsExactlyElementsOf(SoundGuideCatalog.IDS);
    }

    @Test
    void unknownBlankAndNullIdsAreRejected() {
        assertThat(SoundGuideCatalog.isKnown("en-th")).isTrue();
        assertThat(SoundGuideCatalog.isKnown("EN-TH")).isFalse();
        assertThat(SoundGuideCatalog.isKnown("")).isFalse();
        assertThat(SoundGuideCatalog.isKnown(null)).isFalse();
    }
}
