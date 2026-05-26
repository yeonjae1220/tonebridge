# ToneBridge

> 언어 교정 기여 커뮤니티 — 남의 언어를 교정해주면 크레딧 획득 → 내 발음/문장도 교정받는다

## 프로젝트 구조

```
ToneBridge/
├── backend/              Spring Boot 4.0.3 + Java 21 (헥사고날 아키텍처)
├── mobile/               Flutter (iOS · Android · Web PWA)
├── k8s/                  Kubernetes 매니페스트 (Lenovo k3s 클러스터)
│   ├── namespace.yaml
│   ├── network-policy.yaml   ← default-deny-all + 컴포넌트별 allowlist
│   ├── postgres.yaml
│   ├── redis.yaml
│   ├── minio.yaml / minio-init.yaml
│   ├── backend.yaml
│   ├── frontend.yaml         ← Flutter Web (nginx:alpine)
│   └── ingress.yaml          ← cert-manager DNS-01 (Cloudflare)
└── .github/workflows/
    └── deploy.yml            ← GHCR 빌드 + k3s 자동 배포
```

## 로컬 실행

```bash
# Backend (H2 인메모리 DB)
cd backend && ./gradlew bootRun

# Flutter Web (로컬 개발)
cd mobile
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter run -d chrome \
  --dart-define=API_BASE_URL=http://localhost:8080 \
  --dart-define=GOOGLE_CLIENT_ID=<your-web-client-id>
```

접속:
- 웹 앱: http://localhost:8080 (Flutter Web 빌드 시) / 브라우저 자동 오픈 (flutter run)
- 백엔드 API: http://localhost:8080
- MinIO 콘솔: http://localhost:9001

## 인프라 구조

### 클러스터 (Lenovo 온프레미스 k3s)

```
인터넷
  │
  ▼
Cloudflare (DNS + 터널 프록시)
  │  tonebridge.mungji.com → Cloudflare Tunnel
  ▼
cloudflared (서버 내 systemd 서비스)
  │  → https://localhost:32048
  ▼
ingress-nginx (NodePort 32048)
  ├── /api             → backend:8080
  ├── /actuator/health → backend:8080
  └── /               → frontend:80   (Flutter Web, nginx)

k3s 클러스터 노드:
  - lenovo-server (172.30.1.70) — control-plane
  - test-server   (172.30.1.9)  — worker
  - desktop2      (172.30.1.79) — worker

공유 인프라:
  - cert-manager  (v1.17.1) — Let's Encrypt 인증서 자동 발급/갱신
  - ingress-nginx — 인그레스 컨트롤러
```

### TLS 인증서 (cert-manager DNS-01)

Cloudflare 프록시 환경에서 HTTP-01 대신 DNS-01을 사용한다.
cert-manager가 Cloudflare API로 `_acme-challenge.tonebridge.mungji.com` TXT 레코드를
자동 생성/삭제하여 인증서를 발급받는다.

- ClusterIssuer: `letsencrypt-prod`
- solver: `dnsZones: mungji.com` (mungji.com 전체 서브도메인 DNS-01 적용)
- Cloudflare API 토큰: k8s Secret `cloudflare-api-token` (cert-manager 네임스페이스)
- 갱신: 만료 30일 전 자동 갱신 (수동 개입 불필요)

### NetworkPolicy

`default-deny-all` 기반으로 필요한 경로만 허용한다.

```
ingress-nginx → frontend:80    (Flutter Web nginx)
ingress-nginx → backend:8080
frontend      → backend:8080
backend       → postgres:5432, redis:6379, minio:9000
backend       → :443 (외부 API: Google OAuth, Claude API)
postgres      → (격리, egress 없음)
redis         → (격리, egress 없음)
minio         → (격리, egress 없음)
cert-manager ACME solver → ingress-nginx 수신 허용
```

## GitHub Actions CI/CD

main 브랜치 push 시 자동 실행:
1. 백엔드/프론트엔드 Docker 이미지 빌드 → GHCR 푸시
2. k8s 매니페스트 서버 배포 (`kubectl apply`)
3. 이미지 업데이트 + 롤아웃 완료 대기

필요한 GitHub Secrets:

| Secret | 설명 |
|--------|------|
| `POSTGRES_PASSWORD` | PostgreSQL 비밀번호 |
| `REDIS_PASSWORD` | Redis 비밀번호 |
| `JWT_SECRET` | JWT 서명 키 |
| `GOOGLE_CLIENT_ID` | Google OAuth Web 클라이언트 ID (Flutter dart-define에도 주입) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 클라이언트 Secret (백엔드 전용) |
| `CLAUDE_API_KEY` | Claude API 키 |
| `MINIO_ROOT_PASSWORD` | MinIO 루트 비밀번호 |
| `VAPID_KEY` | FCM 웹 푸시 VAPID 키 (Firebase Console → Cloud Messaging) |

## 신규 서버 최초 배포

```bash
# 1. 배포 디렉토리 생성
sudo mkdir -p /opt/tonebridge && sudo chown $USER:$USER /opt/tonebridge

# 2. k8s 매니페스트 복사 (CI/CD가 자동으로 수행)
scp -r k8s/ user@server:/opt/tonebridge/

# 3. 네임스페이스 + Secret 먼저 생성
kubectl apply -f /opt/tonebridge/k8s/namespace.yaml
kubectl create secret generic tonebridge-secret \
  --from-literal=POSTGRES_PASSWORD="..." \
  -n tonebridge

# 4. 나머지 리소스 적용
kubectl apply -f /opt/tonebridge/k8s/

# 5. 상태 확인
kubectl get pods -n tonebridge
kubectl get certificate tonebridge-tls -n tonebridge
```

> cert-manager ClusterIssuer와 Cloudflare API 토큰 Secret은
> 공유 인프라이므로 별도 적용 필요. `/opt/infra/` 참고.

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Frontend | Flutter 3 (iOS · Android · Web PWA), Riverpod, GoRouter, Freezed |
| Backend | Spring Boot 4, Java 21 (Virtual Threads), JPA, Flyway |
| DB | PostgreSQL 16 (prod) / H2 (로컬 단독 실행) |
| Cache | Redis 7 |
| Storage | MinIO (S3 호환, AWS S3 전환 시 endpoint만 변경) |
| AI | Claude claude-sonnet-4-6 (첨삭 품질 검수 + AI 폴백) |
| 푸시 알림 | Firebase Cloud Messaging (FCM) — 웹: VAPID, 네이티브: APNs/FCM |
| 인프라 | k3s, cert-manager, ingress-nginx, Cloudflare Tunnel |
