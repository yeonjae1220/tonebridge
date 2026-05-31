# Deployment Guide

홈랩 k3s 클러스터의 서비스별 배포 방식 정리.

---

## 네트워크 구조

```
인터넷
  │
  ├── Cloudflare Tunnel (cloudflared)
  │     └── HTTPS → 172.30.1.70:32048 (k3s ingress-nginx)
  │           ├── tonebridge.mungji.com
  │           ├── ovlo.mungji.com
  │           ├── snapguide.mungji.com
  │           ├── timemanager.mungji.com
  │           ├── grafana.mungji.com
  │           └── portfolio.mungji.com
  │
  └── WireGuard VPN (wg0, 10.100.0.1/24)
        └── 맥 (10.100.0.2) ← SSH 접속 경로
              → ssh lenovo (172.30.1.70)

lenovo SSH: 172.30.1.70:22 (사설망 내부 전용, 인터넷에서 직접 불가)
```

**GitHub Actions → lenovo 직접 SSH 불가 이유:**
- Cloudflare Tunnel은 HTTPS만 라우팅, SSH 미노출
- WireGuard peer는 맥만 등록
- lenovo SSH(22포트)는 인터넷에 노출되지 않음

**해결책: self-hosted runner** (ToneBridge와 동일한 방식)
- GitHub Actions가 lenovo에서 직접 실행되므로 SSH 불필요

---

## GitHub Actions 자동 배포 (CI/CD)

### ToneBridge

| 항목 | 내용 |
|------|------|
| 레포 | `yeonjae1220/tonebridge` |
| 트리거 | `push to main` |
| 빌드 | `ubuntu-latest` — Docker buildx → GHCR |
| 배포 | `self-hosted [homelab]` — 러너가 lenovo에서 직접 kubectl |
| 러너 서비스 | `actions.runner.yeonjae1220-tonebridge.lenovo-k3s` |
| 러너 경로 | `~/actions-runner/` |

```bash
# runner 상태 확인 / 재시작
ssh lenovo 'sudo systemctl status actions.runner.yeonjae1220-tonebridge.lenovo-k3s'
ssh lenovo 'sudo systemctl restart actions.runner.yeonjae1220-tonebridge.lenovo-k3s'
```

### Ovlo

| 항목 | 내용 |
|------|------|
| 레포 | `yeonjae1220/Ovlo` |
| 트리거 | `push to main` + production 환경 승인 |
| 빌드 | `ubuntu-latest` — Docker buildx → GHCR |
| 배포 | `self-hosted [homelab]` — 러너가 lenovo에서 직접 kubectl |
| 러너 서비스 | `actions.runner.yeonjae1220-Ovlo.lenovo-k3s` |
| 러너 경로 | `~/runners/ovlo/` |

```bash
ssh lenovo 'sudo systemctl status actions.runner.yeonjae1220-Ovlo.lenovo-k3s'
```

### TimeManager

| 항목 | 내용 |
|------|------|
| 레포 | `yeonjae1220/TimeManager` |
| 트리거 | `push to main` |
| 빌드 | `ubuntu-latest` — Docker buildx → GHCR |
| 배포 | `self-hosted [homelab]` — 러너가 lenovo에서 직접 kubectl |
| 러너 서비스 | `actions.runner.yeonjae1220-TimeManager.lenovo-k3s` |
| 러너 경로 | `~/runners/timemanager/` |

```bash
ssh lenovo 'sudo systemctl status actions.runner.yeonjae1220-TimeManager.lenovo-k3s'
```

### SnapGuide

| 항목 | 내용 |
|------|------|
| 레포 | `yeonjae1220/SnapGuide_Back` |
| 트리거 | `push to master` |
| 빌드 | `ubuntu-latest` — Docker buildx → GHCR |
| 배포 | `self-hosted [homelab]` — 러너가 lenovo에서 직접 kubectl |
| 러너 서비스 | `actions.runner.yeonjae1220-SnapGuide_Back.lenovo-k3s` |
| 러너 경로 | `~/runners/snapguide/` |

```bash
ssh lenovo 'sudo systemctl status actions.runner.yeonjae1220-SnapGuide_Back.lenovo-k3s'
```

---

## 수동 배포 (CI/CD 없음)

이 프로젝트들은 직접 lenovo에 SSH 접속해서 관리.

### Hub (mungji.com)

nginx:alpine이 ConfigMap에서 정적 HTML을 마운트해서 서빙.

```bash
# 1. 파일 전송
scp index.html lenovo:/tmp/index.html
scp sw.js lenovo:/tmp/sw.js
scp manifest.json lenovo:/tmp/manifest.json

# 2. ConfigMap 업데이트
ssh lenovo '
sudo kubectl create configmap hub-html \
  --from-file=index.html=/tmp/index.html \
  -n hub --dry-run=client -o yaml | sudo kubectl apply -f -

sudo kubectl create configmap hub-static \
  --from-file=sw.js=/tmp/sw.js \
  --from-file=manifest.json=/tmp/manifest.json \
  -n hub --dry-run=client -o yaml | sudo kubectl apply -f -

sudo kubectl rollout restart deployment/hub -n hub
'
```

### Lab Dashboard (lab.mungji.com)

Go + 정적 HTML. 로컬 빌드 후 lenovo containerd에 직접 import.

```bash
# 1. 로컬에서 linux/amd64 빌드
docker buildx build --platform linux/amd64 \
  -t lab-dashboard:latest \
  ~/Desktop/Project/lab-dashboard

# 2. lenovo로 이미지 전송
docker save lab-dashboard:latest | gzip | \
  ssh lenovo 'sudo k3s ctr images import -'

# 3. Pod 재시작
ssh lenovo 'sudo kubectl rollout restart deployment/lab-dashboard -n lab'
```

### Portfolio (portfolio.mungji.com)

lenovo의 nginx:alpine이 ConfigMap(`portfolio-html`)에서 서빙.
파일 경로: `~/portfolio-k8s/portfolio_web.html`

```bash
# lenovo에서 직접 수정 후 적용
ssh lenovo '
sudo kubectl create configmap portfolio-html \
  --from-file=index.html=~/portfolio-k8s/portfolio_web.html \
  -n portfolio --dry-run=client -o yaml | sudo kubectl apply -f -
sudo kubectl rollout restart deployment/portfolio -n portfolio
'
```

### Uptime Kuma (uptime.mungji.com)

Uptime Kuma 자체 UI에서 직접 관리. k8s 배포 필요 없음.

```bash
# 재시작이 필요한 경우
ssh lenovo 'sudo kubectl rollout restart deployment -n uptime-kuma'
```

### Grafana (grafana.mungji.com)

Helm chart로 배포된 Grafana. 설정 변경은 k8s Secret/ConfigMap 수정 후 재시작.

```bash
ssh lenovo 'sudo kubectl get pods -n monitoring | grep grafana'
```

---

## 이미지 레지스트리

모든 자동 배포 프로젝트는 GitHub Container Registry(GHCR) 사용.

| 이미지 | 태그 전략 |
|--------|----------|
| `ghcr.io/yeonjae1220/tonebridge-frontend` | SHA 태그 (`sha-xxxxxxx`) |
| `ghcr.io/yeonjae1220/tonebridge-backend` | SHA 태그 |
| `ghcr.io/yeonjae1220/ovlo` | SHA 태그 |
| `ghcr.io/yeonjae1220/ovlo-frontend` | SHA 태그 |
| `ghcr.io/yeonjae1220/timemanager` | `latest` |
| `ghcr.io/yeonjae1220/timemanager-frontend` | `latest` |
| `ghcr.io/yeonjae1220/snapguide_back` | SHA 태그 + `latest` |
| `docker.io/library/lab-dashboard` | `latest` (로컬 전용) |

---

## 전체 러너 상태 확인

```bash
ssh lenovo 'sudo systemctl list-units "actions.runner.*" --no-legend'
```

---

## GitHub Secrets 관리 (2026-05-31 추가)

### 핵심 원칙
- `k8s/secret.yaml`에 실제 값 절대 작성 금지 (주석/placeholder만)
- 실제 값은 GitHub Secrets에만 저장
- CI deploy step에서 `kubectl create secret --from-literal` 으로 동적 생성
- **새 secret 추가 시 4곳 동시 수정 필수**: manifest, secret.yaml 주석, deploy.yml env+from-literal, GitHub Secrets

### Secret이 빈 값으로 덮어씌워졌을 때 (긴급 복구)
```bash
# 실행 중인 old pod에서 실제 값 추출
OLD_POD=$(sudo kubectl get pods -n <ns> -l app=backend --sort-by=.metadata.creationTimestamp -o jsonpath="{.items[0].metadata.name}")
ssh lenovo "sudo kubectl exec -n <ns> $OLD_POD -- printenv JWT_SECRET" | \
  gh secret set JWT_SECRET --repo yeonjae1220/<Repo>

# k8s secret 즉시 패치
ENCODED=$(printf '%s' "$VALUE" | base64 | tr -d '\n')
ssh lenovo "sudo kubectl patch secret <secret> -n <ns> --type=json \
  -p '[{\"op\":\"replace\",\"path\":\"/data/JWT_SECRET\",\"value\":\"$ENCODED\"}]'"

# pod 재시작
ssh lenovo "sudo kubectl rollout restart deployment/backend -n <ns>"
```

→ 상세 내용: `/Users/kim-yeonjae/Desktop/Project/docs/k8s-secrets-management.md`

---

## k8s 트러블슈팅 빠른 참조

```bash
# CrashLoopBackOff 원인 확인
ssh lenovo 'sudo kubectl logs <pod> -n <ns> --previous --tail=20 | grep "Caused by"'

# ProgressDeadlineExceeded 후 강제 재시작
ssh lenovo 'sudo kubectl rollout restart deployment/<name> -n <ns>'

# 전체 문제 pod 확인
ssh lenovo 'sudo kubectl get pods -A | grep -v Running | grep -v Completed'
```

→ 상세 내용: `/Users/kim-yeonjae/Desktop/Project/docs/k8s-deployment-troubleshooting.md`

---

## PWA 배포 현황 (2026-05-29)

| 서비스 | manifest | SW | 설치 배너 |
|--------|----------|----|----------|
| ToneBridge | ✅ | ✅ | ✅ (React) |
| Ovlo | ✅ | ✅ | ✅ (React) |
| TimeManager | ✅ (vue pwa plugin) | ✅ (workbox) | ✅ (Vue) |
| Hub | ✅ | ✅ | ✅ (vanilla JS) |
| Lab Dashboard | ✅ | ✅ | ✅ (vanilla JS) |
