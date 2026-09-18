package me.yeonjae.tonebridge.adapter.out.persistence;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 계정 삭제가 연쇄되도록, 삭제 경로에 있는 테이블을 참조하는 외래키에 ON DELETE 규칙이
 * 반드시 있어야 한다.
 *
 * <p>V14 가 한 번 전부 맞췄지만 나중에 추가된 V20(correction_likes)이 규칙 없이 참조를
 * 다시 만들어 계정 삭제가 FK 위반으로 실패했다. 리포지토리를 목으로 대체한 단위 테스트는
 * 이런 결함을 통과시키므로, 마이그레이션 파일 자체를 읽어 규칙을 고정한다.
 */
@DisplayName("마이그레이션 외래키 규칙")
class MigrationForeignKeyRulesTest {

    /** 계정 삭제가 연쇄로 훑고 지나가는 테이블 — 이들을 참조하면 ON DELETE 가 필요하다. */
    private static final Set<String> CASCADE_ROOTS = Set.of("users", "corrections", "correction_requests");

    private static final Pattern VERSION = Pattern.compile("^V(\\d+)__");

    /** ALTER TABLE t ADD CONSTRAINT c FOREIGN KEY (col) REFERENCES ref(id) [ON DELETE rule] */
    private static final Pattern ALTER_FK = Pattern.compile(
            "ALTER\\s+TABLE\\s+(\\w+).*?FOREIGN\\s+KEY\\s*\\(\\s*(\\w+)\\s*\\)\\s*"
                    + "REFERENCES\\s+(\\w+)\\s*\\(\\s*id\\s*\\)(\\s+ON\\s+DELETE\\s+(CASCADE|SET\\s+NULL|RESTRICT))?",
            Pattern.CASE_INSENSITIVE);

    /** ALTER TABLE t ADD COLUMN col UUID REFERENCES ref(id) [ON DELETE rule] */
    private static final Pattern ALTER_COLUMN_FK = Pattern.compile(
            "ALTER\\s+TABLE\\s+(\\w+)\\s+ADD\\s+COLUMN\\s+(\\w+)\\s+UUID[^,]*?"
                    + "REFERENCES\\s+(\\w+)\\s*\\(\\s*id\\s*\\)(\\s+ON\\s+DELETE\\s+(CASCADE|SET\\s+NULL|RESTRICT))?",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern CREATE_TABLE = Pattern.compile(
            "CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(\\w+)\\s*\\((.*)\\)", Pattern.CASE_INSENSITIVE);

    /** CREATE TABLE 본문의 컬럼 정의 안에 있는 참조 */
    private static final Pattern INLINE_FK = Pattern.compile(
            "(\\w+)\\s+UUID[^,]*?REFERENCES\\s+(\\w+)\\s*\\(\\s*id\\s*\\)"
                    + "(\\s+ON\\s+DELETE\\s+(CASCADE|SET\\s+NULL|RESTRICT))?",
            Pattern.CASE_INSENSITIVE);

    @Test
    @DisplayName("계정 삭제 경로의 테이블을 참조하는 외래키에는 ON DELETE 규칙이 있다")
    void everyForeignKeyOnTheDeletePathDeclaresAnOnDeleteRule() {
        // (테이블.컬럼 -> 규칙). 나중 버전이 앞 버전을 덮어쓴다.
        Map<String, String> rules = new LinkedHashMap<>();

        for (Path file : migrationFiles()) {
            for (String statement : statements(file)) {
                Matcher alter = ALTER_FK.matcher(statement);
                if (alter.find() && CASCADE_ROOTS.contains(alter.group(3).toLowerCase())) {
                    rules.put(key(alter.group(1), alter.group(2)), rule(alter.group(5)));
                    continue;
                }
                Matcher alterColumn = ALTER_COLUMN_FK.matcher(statement);
                if (alterColumn.find() && CASCADE_ROOTS.contains(alterColumn.group(3).toLowerCase())) {
                    rules.put(key(alterColumn.group(1), alterColumn.group(2)), rule(alterColumn.group(5)));
                    continue;
                }
                Matcher create = CREATE_TABLE.matcher(statement);
                if (create.find()) {
                    String table = create.group(1);
                    Matcher inline = INLINE_FK.matcher(create.group(2));
                    while (inline.find()) {
                        if (CASCADE_ROOTS.contains(inline.group(2).toLowerCase())) {
                            rules.put(key(table, inline.group(1)), rule(inline.group(4)));
                        }
                    }
                }
            }
        }

        assertThat(rules)
                .as("마이그레이션에서 %s 참조를 하나도 못 찾았다면 파서가 깨진 것이다", CASCADE_ROOTS)
                .isNotEmpty();

        List<String> missing = rules.entrySet().stream()
                .filter(e -> e.getValue().equals("NONE"))
                .map(Map.Entry::getKey)
                .toList();

        assertThat(missing)
                .as("ON DELETE 규칙이 없는 외래키 — 이 컬럼에 값이 있으면 계정 삭제가 FK 위반으로 통째로 실패한다")
                .isEmpty();
    }

    private String key(String table, String column) {
        return table.toLowerCase() + "." + column.toLowerCase();
    }

    private String rule(String captured) {
        return captured == null ? "NONE" : captured.toUpperCase().replaceAll("\\s+", " ");
    }

    /** 하나의 문장으로 정규화(개행/중복 공백 제거)해 여러 줄에 걸친 제약 선언도 한 정규식으로 잡는다. */
    private List<String> statements(Path file) {
        try {
            String sql = Files.readString(file)
                    .replaceAll("--[^\n]*", " ")   // 한 줄 주석 제거
                    .replaceAll("\\s+", " ");
            return Stream.of(sql.split(";")).map(String::trim).filter(s -> !s.isEmpty()).toList();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private List<Path> migrationFiles() {
        Path dir = Paths.get("src/main/resources/db/migration");
        if (!Files.isDirectory(dir)) {
            dir = Paths.get("backend/src/main/resources/db/migration");
        }
        assertThat(Files.isDirectory(dir)).as("마이그레이션 디렉터리를 찾지 못했다: %s", dir.toAbsolutePath()).isTrue();
        try (Stream<Path> files = Files.list(dir)) {
            return files.filter(p -> p.getFileName().toString().endsWith(".sql"))
                    .sorted(Comparator.comparingInt(this::version))
                    .toList();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private int version(Path path) {
        Matcher m = VERSION.matcher(path.getFileName().toString());
        return m.find() ? Integer.parseInt(m.group(1)) : Integer.MAX_VALUE;
    }
}
