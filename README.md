# ToneBridge

> 언어 교정 기여 커뮤니티 — 남의 언어를 교정해주면 크레딧 획득 → 내 발음/문장도 교정받는다

## 프로젝트 구조

```
ToneBridge/
├── backend/    Spring Boot 4.0.3 + Java 21 (헥사고날 아키텍처)
├── frontend/   Next.js 14 (App Router + Tailwind CSS)
└── k8s/        Kubernetes 매니페스트 (Lenovo k3s 클러스터)
```

## 로컬 실행 (Docker Compose)

```bash
# 1. 환경변수 파일 복사 & 설정
cp .env.example .env
# .env 파일에서 GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET 등 입력

# 2. 전체 스택 실행
docker compose up -d

# 로그 확인
docker compose logs -f backend
docker compose logs -f frontend

# 중지
docker compose down
```

접속:
- 프론트엔드: http://localhost:3000
- 백엔드 API: http://localhost:8080
- MinIO 콘솔: http://localhost:9001 (minioadmin / minioadmin)

## 로컬 개발 (개별 실행)

```bash
# Backend (H2 인메모리 DB + 로컬 Redis 없이)
cd backend
./gradlew bootRun

# Frontend
cd frontend
npm install
npm run dev
```

## k8s 배포 (Lenovo k3s)

### 최초 배포

```bash
# 1. secret.yaml 편집 (실제 값으로 교체)
vim k8s/secret.yaml

# 2. 매니페스트 적용
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/minio.yaml
kubectl apply -f k8s/minio-init.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/ingress.yaml

# 3. 상태 확인
kubectl get pods -n tonebridge
kubectl logs -n tonebridge deployment/backend
```

접속: https://tonebridge.mungji.com

### GitHub Actions CI/CD

main 브랜치 push 시 자동 빌드 & 배포.

필요한 GitHub Secrets:
| Secret | 설명 |
|--------|------|
| `DEPLOY_HOST` | Lenovo 서버 주소 (DDNS) |
| `DEPLOY_USER` | SSH 접속 유저 |
| `DEPLOY_SSH_KEY` | SSH 개인키 |

### 서버 사전 준비

```bash
# 서버에서 k8s manifests 배치
mkdir -p /opt/tonebridge/k8s
# k8s/ 폴더 내용을 서버로 복사 (secret.yaml은 직접 편집)

# GHCR 이미지 pull을 위한 인증 (서버에서)
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=yeonjae1220 \
  --docker-password=<GITHUB_PAT> \
  -n tonebridge
```

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Frontend | Next.js 14, Tailwind CSS, Zustand, TanStack Query |
| Backend | Spring Boot 4, Java 21 (Virtual Threads), JPA, Flyway |
| DB | PostgreSQL 16 (prod) / H2 (로컬 단독 실행) |
| Cache | Redis 7 |
| Storage | MinIO (S3 호환) |
| AI | Claude claude-sonnet-4-6 (품질 검수) |
| 인프라 | k3s (Lenovo 온프레미스), cert-manager, ingress-nginx |
