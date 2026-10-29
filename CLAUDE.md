# ToneBridge — CLAUDE.md

친구와 표현·예시 음성·연습·피드백을 주고받는 상호 언어 학습 서비스. 개인 연습과 커뮤니티도 유지하며, MVP는 크레딧 없이 이용한다.

## 서비스 URL
- 웹: https://tonebridge.mungji.com
- 배포: k8s (lenovo k3s) + GitHub Actions CI/CD

## 기술 스택

### 프론트엔드 (Next.js 14)
- Next.js 14 App Router, TypeScript, Tailwind CSS
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
- 과거 크레딧 이력 (호환 조회만 유지, 신규 차감·지급 없음)
- 학습 (study) — 지속적인 개인/친구 연습장, 예시·시도·피드백
- 친구 (friends)

## 문서
- [제품 정책](docs/product/mvp-policy.md) · [사용자 흐름](docs/product/user-flows.md) · [전환 및 검증](docs/product/delivery-plan.md)
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
