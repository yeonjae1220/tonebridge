# ToneBridge Frontend — 보안 아키텍처

> 마지막 업데이트: 2026-05-31
> 대상: `frontend/` (Next.js 15, App Router)

---

## 1. 토큰 저장 전략

| 토큰 | 저장 위치 | 이유 |
|------|-----------|------|
| `accessToken` | **메모리** (Zustand store) | localStorage 저장 시 XSS로 탈취 가능 |
| `refreshToken` | **httpOnly 쿠키** (서버 관리) | JavaScript 접근 불가, CSRF는 SameSite=Lax로 완화 |

```
페이지 리로드 시 복원 흐름:
  (protected)/layout.tsx
      → refreshAuth() [싱글톤]
      → POST /api/v1/auth/refresh (쿠키 자동 전송)
      → setAccessToken(newToken)
```

**`refreshAuth.ts` 싱글톤 패턴**: layout과 axios interceptor가 동시에 refresh를 호출해도 단 하나의 Promise만 실행됩니다. refresh token rotation 환경에서의 이중 소비를 방지합니다.

---

## 2. CSP (Content Security Policy)

**구현 방식**: `src/middleware.ts` — 요청마다 nonce 생성, 응답 헤더에 적용

```
script-src 'nonce-{random}' 'strict-dynamic' 'unsafe-inline'
```

| 지시어 | 역할 |
|--------|------|
| `'nonce-{random}'` | 요청마다 고유 nonce — 인라인 스크립트 허용 조건 |
| `'strict-dynamic'` | nonce된 스크립트가 로드하는 하위 스크립트 허용 (Next.js chunk loading) |
| `'unsafe-inline'` | CSP Level 1 구형 브라우저 폴백 (모던 브라우저는 nonce 있으면 이 값 무시) |
| `base-uri 'self'` | `<base>` 태그 인젝션으로 인한 open redirect 방지 |

---

## 3. 인증 미들웨어

`src/middleware.ts`는 CSP 생성과 보호 경로 인증 리다이렉트를 함께 처리합니다.

```typescript
// 보호 경로 목록
const PROTECTED = ['/request', '/correct', '/wallet', '/profile', '/admin', '/onboarding']
```

open redirect 방지: `login?redirect=` 파라미터는 `/`로 시작하되 `//`로 시작하지 않는 경로만 허용합니다.

---

## 4. OAuth state CSRF 방어

Google 로그인 시 `crypto.randomUUID()`로 생성한 state를 **쿠키**에 저장합니다 (sessionStorage 대신).

```typescript
// LoginPage.tsx → saveOauthState(state) → SameSite=Lax 쿠키
// OAuthCallbackPage → consumeOauthState() → state 검증 후 쿠키 삭제
```

sessionStorage 대신 쿠키를 사용하는 이유: iOS Safari 인앱 브라우저 등 일부 환경에서 OAuth 왕복 중 sessionStorage가 초기화될 수 있습니다.

---

## 5. 보안 헤더 (next.config.mjs)

CSP는 middleware에서 생성, 나머지는 next.config에서 정적 설정:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

## 6. 알려진 개선 필요 사항

| 항목 | 위치 | 설명 |
|------|------|------|
| Redis key 해시화 | `RefreshTokenRedisAdapter.java:22` | refresh token 원문을 HMAC-SHA256 해시로 교체 권장 |
