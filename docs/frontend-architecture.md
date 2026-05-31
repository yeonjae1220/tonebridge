# ToneBridge Frontend — 아키텍처

> Next.js 15 App Router, TypeScript, Tailwind CSS

---

## 디렉토리 구조

```
frontend/src/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # 루트 레이아웃 (nonce 읽기, Providers)
│   ├── middleware.ts           # CSP nonce 생성 + 인증 리다이렉트
│   ├── page.tsx                # 랜딩/홈 (토큰 여부에 따라 분기)
│   ├── login/                  # 로그인
│   ├── feed/                   # 피드 (첨삭 요청 목록)
│   ├── request/                # 첨삭 요청 작성
│   ├── correct/[requestId]/    # 첨삭 수행
│   ├── result/[requestId]/     # 결과 확인
│   ├── study/                  # 학습
│   ├── profile/                # 프로필, 설정, 지갑
│   └── admin/                  # 관리자
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
  이메일/비밀번호 → POST /api/v1/auth/login
  → { accessToken, memberId } 반환
  → accessToken: Zustand 메모리 저장
  → refreshToken: 서버가 httpOnly 쿠키로 설정

[페이지 리로드]
  middleware.ts → (protected) layout.tsx
  → accessToken 없음 → refreshAuth()
  → POST /api/v1/auth/refresh (쿠키 자동)
  → 새 accessToken 메모리 저장

[API 요청 401]
  axios interceptor → refreshAuth() 싱글톤
  → 동시 요청이 여러 개여도 refresh는 1회만
```

---

## 기술 결정 기록

| 결정 | 이유 |
|------|------|
| accessToken을 localStorage에 저장하지 않음 | XSS 탈취 위험 제거 |
| nonce 기반 CSP | `unsafe-inline` 단독 사용보다 XSS 방어 강화 |
| refresh 싱글톤 패턴 | rotation 사용 시 이중 소비로 인한 강제 로그아웃 방지 |
| OAuth state를 sessionStorage 대신 쿠키 사용 | iOS Safari 인앱 브라우저 호환성 |

---

## k8s 환경변수

| 변수 | 설명 |
|------|------|
| `API_URL` | 백엔드 클러스터 내부 URL (서버 전용, 클라이언트 번들 미포함) |
| `PORT` | Next.js 서버 포트 (3000) |
| `HOSTNAME` | 바인딩 주소 (0.0.0.0) |
