# ToneBridge

> 언어 교정 기여 커뮤니티 — 남의 언어를 교정해주면 크레딧 획득 → 내 발음/문장도 교정받는다

## 프로젝트 구조

```
ToneBridge/
├── backend/    Spring Boot 4.0.3 + Java 21 (헥사고날 아키텍처)
├── frontend/   Next.js 14 (App Router + Tailwind CSS)
└── k8s/        Kubernetes 매니페스트 (Lenovo k3s 클러스터)
```

## 로컬 개발

### Backend
```bash
cd backend
./gradlew bootRun
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 배포

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.yaml        # 실제 값으로 교체 필요
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/minio.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/ingress.yaml
```

## 기술 스택

| 영역 | 기술 |
|------|------|
| Backend | Spring Boot 4.0.3 + Java 21 Virtual Threads |
| Database | PostgreSQL 16 + Flyway |
| Cache/Realtime | Redis + SSE (SseEmitter) |
| Storage | MinIO (S3 호환 → AWS S3 전환 가능) |
| Frontend | Next.js 14 + Tailwind CSS |
| Mobile (예정) | Flutter |
| AI | Claude claude-sonnet-4-6 (품질 검수) + Whisper STT |
| Infra | Lenovo k3s + cert-manager + ingress-nginx |
