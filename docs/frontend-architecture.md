# ToneBridge Frontend — 아키텍처

> Next.js 15 App Router, TypeScript, Tailwind CSS

현재 제품 흐름은 [친구 중심 사용자 흐름](product/user-flows.md)을 기준으로 한다. 크레딧 화면을 기본 동선에 추가하지 않는다.

---

## 디렉토리 구조

```
frontend/src/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # 루트 레이아웃 (nonce 읽기, Providers)
│   ├── page.tsx                # 랜딩/홈 (토큰 여부에 따라 분기)
│   ├── login/                  # 로그인
│   ├── feed/                   # 피드 (첨삭 요청 목록)
│   ├── request/                # 첨삭 요청 작성
│   ├── correct/[requestId]/    # 첨삭 수행
│   ├── result/[requestId]/     # 결과 확인
│   ├── study/                  # 학습
│   ├── profile/                # 프로필, 설정 (옛 지갑 URL은 학습 홈으로 이동)
│   └── admin/                  # 관리자
├── middleware.ts               # CSP nonce 생성 + 인증 리다이렉트
├── components/
│   ├── AppShell.tsx            # 전체 레이아웃 (헤더, 네비게이션)
│   └── landing/                # 랜딩 컴포넌트
├── stores/
│   └── authStore.ts            # Zustand (accessToken 메모리 전용)
├── hooks/
│   └── useCurrentUser.ts       # 현재 사용자 조회
└── i18n/                       # 다국어 지원
```

---

## 인증 흐름

```
[로그인]
  이메일/비밀번호 → POST /api/auth/login → { accessToken }
  → beginSession: Zustand 메모리에 저장, 세션 세대 변경 및 이전 Query 캐시 제거
  → refresh token: 서버가 HttpOnly 쿠키로 설정

[페이지 리로드]
  middleware의 session 쿠키 확인은 화면 이동용 힌트
  → Providers가 tryRestoreSession() 완료 후 화면 렌더
  → accessToken이 없으면 POST /api/auth/refresh (쿠키 자동)

[API 요청 401]
  요청 시점의 세션 세대 확인 → refreshAccessToken()
  → 같은 세션의 동시 요청은 하나의 Promise 공유 → 같은 세션에서만 재전송

[계정 전환 / 로그아웃]
  세션 세대 변경 → 이전 Query 캐시와 녹음 정리, 이전 refresh 취소
  → 늦은 응답 거부, 이전 요청을 새 계정으로 재전송하지 않음
  → 로그인/가입 화면 이탈 및 새 인증 시도 시 이전 인증 HTTP 요청도 취소
  → 로그아웃 쿠키 정리 후 새 비밀번호 로그인/가입 허용
```

서버에 이미 전달된 변경 작업을 취소하거나 되돌린다는 의미는 아니다.
서버의 JWT·객체별 권한 검사는 [보안 경계](frontend-security.md)를 따른다.

---

## 기술 결정 기록

| 결정 | 이유 |
|------|------|
| accessToken을 localStorage에 저장하지 않음 | 영속 저장소의 토큰 노출을 줄임. XSS 자체를 막지는 않음 |
| nonce 기반 CSP | `unsafe-inline` 단독 사용보다 XSS 방어 강화 |
| refresh 싱글톤 패턴 | rotation 사용 시 이중 소비로 인한 강제 로그아웃 방지 |
| OAuth state는 백엔드가 생성·검증·소비 | 브라우저가 인증 상태 검증을 대신하지 않음 |

---

## k8s 환경변수

| 변수 | 설명 |
|------|------|
| `API_URL` | 백엔드 클러스터 내부 URL (서버 전용, 클라이언트 번들 미포함) |
| `PORT` | Next.js 서버 포트 (3000) |
| `HOSTNAME` | 바인딩 주소 (0.0.0.0) |
