# Changelog

이 프로젝트의 모든 주요 변경 사항을 기록합니다.

형식은 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)를 따르며,
[유의적 버전(SemVer)](https://semver.org/lang/ko/)을 준수합니다.
0.x 구간이므로 파괴적 변경도 MINOR 버전으로 흡수합니다.

## [Unreleased]

## [0.4.0] - 2026-06-30

관측성(구조화 로깅)과 운영 엔드포인트(콘솔 집계·피드백)에 집중한 릴리스.

### Added
- `lab.mungji` 콘솔 집계용 내부 엔드포인트
- JWT `userId`를 MDC에 실어 logstash JSON 구조화 로그 출력
- HTTP 요청당 1줄 access log 추가 (`logger_name=access`)
- 개발자 피드백 수집 엔드포인트 추가 (토큰 시작 검증 + NetworkPolicy)

### Fixed
- `/admin` ingress 라우트 추가 + `securityMatcher`를 PathPattern으로 전환 (GLOBAL-PIT-040)
- MDC outer try/finally 보강
- `/api/internal` 요청을 access log에서 제외 (lab-dashboard 폴링 수치 제거)

## [0.3.0] - 2026-06-08

SSR 관리자 패널과 SEO, 프론트엔드 보안을 강화한 릴리스.

### Added
- SSR 기반 관리자 패널 구축 (InMemory 인증)
- SEO — OG 태그, sitemap, robots.txt
- 라이트/다크 테마 모드 지원
- 스터디 워크플로우 우선 UI
- k8s liveness/readiness probe 분리 + actuator health 그룹

### Security
- nonce 기반 CSP 완성 — strict-dynamic, base-uri, layout nonce
- 관리자 인증 강화 및 credential 검증 하드닝
- 보안 헤더 추가, API_URL 환경변수 정리

### Fixed
- App Router hydration용 CSP 및 평가 이슈 해결
- 로컬 로그인 타이밍 및 refresh token 저장 하드닝
- 스터디 내비게이션 및 인증 요청 안전장치 보강
- postgres/minio PVC `storageClassName` 고정으로 배포 실패 방지

## [0.2.0] - 2026-05-29

방언 선택과 Flutter Web/PWA, Next.js 웹 전환을 도입한 릴리스.

### Added
- 모국어·구사·학습 언어별 방언(dialect/variant) 선택 (Phase 1~3) 및 프로필/피드 카드에 방언 라벨 표시
- 웹·앱 회원탈퇴 기능, 유저 검색·닉네임 설정, 친구 검색 UX
- 스터디: 마이크 권한 UX, 다중 음성 녹음, FAB Speed Dial, 카드 검색/정렬
- 카드/녹음 메모 기능 — 공유 카드 메모 + 녹음별 개인 메모
- Flutter Web + PWA 배포 지원, PWA 설치 배너 + manifest
- 관리자 web 라우트, 첨삭(correction) 수정·삭제 플로우, 첨삭 스터디 플로우
- 다국어(i18n) UI 지원
- 다중 첨삭 수령 + 채택 + 좋아요 기능

### Changed
- 웹 배포를 Next.js로 전환하고 Flutter UX와 정합
- Google 로그인 웹 대응 및 Firebase 웹 설정 적용

### Fixed
- **Firebase 완전 제거** — 서버사이드 OAuth로 웹 로그인 재구성 (UnimplementedError 해결)
- 웹 로그인 팝업 → 리다이렉트 전환, OAuth 토큰을 URL hash에서 추출
- Cloudflare가 Flutter 엔트리포인트 파일을 캐시하지 않도록 수정, PathUrlStrategy 전환
- nginx CrashLoopBackOff(emptyDir 볼륨), frontend NetworkPolicy 포트, MinIO presigned URL 브라우저 접근 수정
- 언어 선택 UI — 한국어/러시아어 누락 및 스크롤 잘림 수정

## [0.1.0] - 2026-05-21

언어 교정 기여 커뮤니티의 첫 릴리스. 남의 언어를 교정해주면 크레딧을 얻고, 그 크레딧으로 내 발음·문장을 교정받는 구조.

### Added
- 음성 첨삭 루프 전체 구현 (Phase 3)
- gamification, 관리자, AI fallback, FCM 푸시 알림 (Phase 5+6)
- Flutter 모바일 앱 — `google_sign_in` SDK OAuth 플로우
- 핵심 앱 기능 — Feed, Request, Correction, Profile, Wallet
- Private Study Session — Friend, Session, Card 도메인, 오디오 재생, 세션 종료, 친구 거절/삭제
- 언어 변형(dialect/accent) 선택 + 피드 부스팅
- 랜딩 페이지, middleware 인증 게이트, 로그인 후 리다이렉트 플로우, 하단 내비게이션
- FCM 딥링크 내비게이션 (Phase A)
- 프로필 언어 설정 편집, AWS S3 스토리지 연동

### Changed
- refresh token을 httpOnly 쿠키 기반으로 이전
- Let's Encrypt TLS(DNS-01) 및 ACME solver NetworkPolicy 구성

### Security
- 인증·첨삭 접근 하드닝, 감사에서 발견된 CRITICAL/HIGH 인프라 취약점 수정
- 오디오 접근 CRITICAL 취약점 패치, 스토리지 감사 대응
- 누락된 JWT 자격증명에 401(403 아님) 응답

[Unreleased]: https://github.com/yeonjae1220/tonebridge/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/yeonjae1220/tonebridge/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/yeonjae1220/tonebridge/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/yeonjae1220/tonebridge/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/yeonjae1220/tonebridge/releases/tag/v0.1.0
