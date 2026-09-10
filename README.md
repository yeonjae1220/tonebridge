# ToneBridge

ToneBridge is a language-correction credit community: users contribute feedback on another person's language to earn credits, then use credits to request feedback on their own pronunciation or writing.

## What the project demonstrates

- **Token refresh under concurrent requests** — a learning screen can issue several protected requests at once. A single-flight refresh queue collapses four competing refreshes into one and lets waiting requests retry with the new token.
- **Direct object-storage upload** — the backend authorizes an upload and issues a presigned URL; audio bytes flow directly between the client and object storage instead of transiting the application server.
- **Domain rules in one place** — credit balance, duplicate grant, and exchange rules live in the domain layer rather than being duplicated across controllers.
- **Deployment boundaries** — the service uses Kubernetes network policies with a default-deny posture and explicit service-to-service paths.

## Architecture

```text
Web (Next.js) / Mobile (Flutter)
            │
            ▼
      Spring Boot API
       ├── PostgreSQL
       ├── Redis
       └── S3-compatible object storage
```

The public README intentionally keeps host topology, internal addresses, deployment paths, and secret-handling procedures out of the repository. Those belong in private operational documentation.

## Stack

| Area | Technology |
| --- | --- |
| Web | Next.js, TypeScript, Tailwind CSS |
| Mobile | Flutter, Riverpod, GoRouter, Freezed |
| Backend | Java 21, Spring Boot, JPA, Flyway, ports and adapters |
| Data | PostgreSQL, Redis, MinIO / S3-compatible storage |
| Operations | Docker, Kubernetes, ingress, CI/CD, network policy |

## Local development

```bash
# Backend (H2 for local development)
cd backend && ./gradlew bootRun

# Web application
cd frontend && npm install && npm run dev

# Flutter application
cd mobile
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:8080
```

Use local, non-production credentials only. See `.env.example` files where available; never commit a populated environment file.

For the technical decision records and measured outcomes, see the [portfolio](https://portfolio.mungji.com/#p02).
