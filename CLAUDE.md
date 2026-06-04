# ToneBridge — CLAUDE.md

언어 교정 교환 커뮤니티. 원어민과 일반 사용자가 서로의 글을 교정해주고 크레딧으로 보상받는 플랫폼.

## 서비스 URL
- 웹: https://tonebridge.mungji.com
- 배포: k8s (lenovo k3s) + GitHub Actions CI/CD

## 기술 스택

### 프론트엔드 (Next.js 15)
- Next.js 15 App Router, TypeScript, Tailwind CSS
- Zustand (authStore), TanStack Query
- 다국어: 커스텀 i18n (ko/en/ja 등)

### 백엔드 (Spring Boot)
- Java 21, Spring Boot
- PostgreSQL, Redis (JWT + refresh token rotation)
- WebSocket (실시간 알림)

### 모바일 (Flutter)
- `mobile/` 디렉토리
- Firebase Auth, Riverpod 3.x

## 핵심 도메인
- 첨삭 요청 (request) / 첨삭 수행 (correct) / 결과 확인 (result)
- 크레딧 시스템 (wallet)
- 학습 (study) — 플래시카드
- 친구 (friends)

## 문서
- [`docs/frontend-security.md`](docs/frontend-security.md) — CSP, 토큰 전략
- [`docs/frontend-architecture.md`](docs/frontend-architecture.md) — 라우팅, 구조
- [`docs/homelab/`](docs/homelab/) — 인프라, CI/CD

## CI/CD
```bash
# runner 상태
ssh lenovo 'sudo systemctl status actions.runner.yeonjae1220-tonebridge.lenovo-k3s'

# 배포 확인
ssh lenovo 'sudo kubectl get pods -n tonebridge'
```

<!-- LLM-WIKI-REF:START -->
## 📚 LLM-Wiki 참조
이 프로젝트의 축적 지식(설계·기능·ADR·트러블슈팅): `~/Desktop/LLM-Wiki/Projects/ToneBridge/`
작업 전 관련 노트 확인, 작업 후 `/llm-wiki-update`.
<!-- LLM-WIKI-REF:END -->
