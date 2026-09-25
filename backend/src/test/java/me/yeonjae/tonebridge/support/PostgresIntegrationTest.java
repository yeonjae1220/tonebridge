package me.yeonjae.tonebridge.support;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * 운영과 같은 PostgreSQL + Flyway 마이그레이션 위에서 도는 통합 테스트의 베이스.
 *
 * <p>기본 테스트 DB(H2 + Flyway 꺼짐 + create-drop)로는 ON CONFLICT·FK·트랜잭션 abort 같은
 * DB 동작이 안 잡힌다. Docker 가 필요하다(CI 의 ubuntu-latest 에는 있다).
 *
 * <p>컨테이너는 @Container 가 아니라 static 블록에서 JVM 당 한 번 띄운다 — @Container 는 클래스 단위로
 * 내려가서, 컨텍스트 캐시를 공유하는 다음 테스트 클래스가 죽은 포트를 보게 된다(GLOBAL-PIT-148).
 */
@SpringBootTest
@ActiveProfiles("test")
public abstract class PostgresIntegrationTest {

    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        registry.add("spring.jpa.properties.hibernate.dialect", () -> "org.hibernate.dialect.PostgreSQLDialect");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "none");
        registry.add("spring.flyway.enabled", () -> "true");
    }
}
