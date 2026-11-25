# Android — Play Console 출시 준비

기준일: 2026-11-25 · 패키지 `com.mungji.tonebridge` · 2단계(Android 조기 트랙)

신규 **개인** 개발자 계정은 프로덕션을 열기 전에 **비공개 테스트에 12명 이상이 14일 연속 참여**해야 한다.
이 14일이 출시 일정에서 가장 긴 구간이므로, 앱이 완성되기 전에 테스트 트랙부터 올린다.
14일 카운트는 비공개 테스트에 빌드가 게시되고 테스터가 참여(opt-in)한 날부터 센다.

## 1. 사람이 해야 하는 일 (순서대로)

| # | 할 일 | 어디서 | 비고 |
|---|---|---|---|
| 1 | Play Console 개발자 계정 등록 (개인, $25) | play.google.com/console | 신원 확인·기기 인증에 며칠 걸릴 수 있다. 가장 먼저 |
| 2 | 앱 만들기 — 이름 `ToneBridge`, 기본 언어 한국어, 앱, 무료 | Play Console | 무료로 만들면 유료로 못 바꾼다 |
| 3 | 내부 테스트 트랙에 AAB 업로드 | 테스트 → 내부 테스트 | 첫 업로드 때 **Play 앱 서명**에 등록된다(기본값 유지) |
| 4 | 앱 서명 키 SHA-1 복사 | 설정 → 앱 서명 | 업로드 키와 **다른** 값이다 |
| 5 | Google Cloud에 Android OAuth 클라이언트 2개 생성 | console.cloud.google.com → 사용자 인증 정보 | 패키지 `com.mungji.tonebridge` + SHA-1 각각: ① 업로드 키 ② 앱 서명 키. 없으면 Play에서 받은 빌드의 Google 로그인이 실패한다 |
| 6 | 앱 콘텐츠 양식 작성 | 정책 → 앱 콘텐츠 | 아래 3~5절 답안 |
| 7 | 비공개 테스트 트랙 생성, 테스터 12명+ 등록 | 테스트 → 비공개 테스트 | Google 그룹 하나를 테스터 목록으로 쓰면 관리가 쉽다. 여유분으로 15명 이상 권장 |
| 8 | 14일 후 프로덕션 액세스 신청 | 대시보드 | 테스트 중 받은 피드백과 변경 사항을 묻는 설문이 나온다 |

업로드 키 SHA-1: `17:17:8E:C2:46:32:58:69:44:04:5C:0E:DC:BB:32:FC:FA:0E:3A:64`
(키 위치·백업은 gpunode `~/.android-keys/tonebridge/`, NAS `/volume1/yeonjae/secrets/android-signing/`. 새로 만들지 말 것.)

## 2. 빌드

gpunode WSL에서:

```bash
source ~/.android-env.sh
cd ~/Desktop/Project/ToneBridge/mobile
make store-android        # = scripts/build_store.sh android
```

- 결과: `build/app/outputs/bundle/release/app-release.aab`
- versionCode = `git rev-list --count HEAD` — 커밋할 때마다 증가하므로 같은 코드 재업로드 충돌이 없다.
- 깨끗한 작업트리에서만 빌드된다(`ALLOW_DIRTY=1`로 우회 가능, 업로드용으로는 쓰지 말 것).
- `GOOGLE_CLIENT_ID`는 레포 루트 `.env`(gitignore)에서 읽는다.
- 난독화 심볼은 `build/debug-info/`에 남는다. 크래시 스택을 풀려면 버전별로 보관해야 한다.

2026-11-25 첫 빌드 확인값(커밋 97fa390, versionCode 340): 55.8MB, 업로드 키 서명 확인,
minSdk 24 · targetSdk 36. 병합된 권한은 `INTERNET`·`ACCESS_NETWORK_STATE`·`RECORD_AUDIO`와
`USE_BIOMETRIC`·`USE_FINGERPRINT`(flutter_secure_storage가 추가 — 앱은 생체 인증을 쓰지 않지만 Play 신고 대상 권한은 아니다).
릴리스 매니페스트에 `INTERNET`을 직접 적지 않았는데 플러그인이 넣어 준다 — 플러그인을 바꾸면 다시 확인할 것.

## 3. 데이터 보안 양식 (Data safety)

앱에 분석·광고·크래시 수집 SDK는 없다(2026-11-25 `pubspec.yaml` 기준). 수집 항목은 서비스 제공에 쓰는 것뿐이다.

| 질문 | 답 |
|---|---|
| 사용자 데이터를 수집하거나 공유하나요? | 수집함 / **제3자 공유 안 함** |
| 전송 중 암호화 | 예 (HTTPS) |
| 사용자가 삭제를 요청할 수 있나요? | 예 — 앱 프로필 설정의 계정 삭제, 웹 `https://tonebridge.mungji.com/profile` |

| 데이터 유형 | 수집 | 필수/선택 | 목적 |
|---|---|---|---|
| 개인 정보 → 이메일 주소 | 예 | 필수 | 계정 관리 |
| 개인 정보 → 사용자 ID (닉네임·내부 ID) | 예 | 필수 | 계정 관리, 앱 기능 |
| 오디오 → 음성 또는 사운드 녹음 | 예 | 선택 | 앱 기능 (발음 연습·예시 음성) |
| 메시지 → 기타 인앱 메시지 (피드백·메모) | 예 | 선택 | 앱 기능 |
| 앱 활동 → 기타 사용자 생성 콘텐츠 (문장·카드) | 예 | 선택 | 앱 기능 |
| 위치·연락처·사진·결제·기기 ID | 아니요 | — | — |

⚠️ 푸시(FCM)를 앱에 넣으면 "기기 또는 기타 ID"가 추가된다 — 그때 양식을 고친다.
⚠️ 처리방침 본문과 이 표가 일치해야 한다. 처리방침 페이지가 완성되면 대조할 것.

## 4. 기타 앱 콘텐츠 답안

| 항목 | 답 |
|---|---|
| 개인정보처리방침 URL | `https://tonebridge.mungji.com/privacy` — **아직 페이지 없음, 등록 전 필수** |
| 광고 포함 | 아니요 |
| 앱 액세스 권한 | 일부 기능 제한 → 심사용 이메일 계정 제공 (이메일 로그인, PR #90) |
| 콘텐츠 등급 설문 | 카테고리: 그 외(참고·교육). 폭력·성적 콘텐츠·도박 없음. **사용자 간 상호작용·사용자 생성 콘텐츠 공유: 예** |
| 타겟 연령 | 13세 이상만 선택 (13세 미만을 포함하면 가족 정책 심사가 붙는다) |
| 뉴스 앱 / 정부 앱 / 금융 기능 / 건강 | 아니요 |
| 계정 삭제 | 앱 내 + 웹 URL 둘 다 있음 (위 3절) |

## 5. 스토어 등록정보 초안

**앱 이름**: ToneBridge

**간단한 설명** (80자 이내)
- ko: 친구와 표현·예시 음성을 주고받고, 피드백을 보며 다시 연습하는 언어 학습
- en: Swap phrases and voice examples with friends, then practice again with feedback.

**자세한 설명 (ko)**

> ToneBridge는 서로의 언어를 배우는 친구끼리 표현과 발음을 주고받는 앱입니다.
>
> • 배우고 싶은 표현을 카드로 만들고, 원어민 친구에게 예시 음성을 받아 보세요.
> • 내 발음을 녹음해 보내면 친구가 피드백을 남겨 줍니다.
> • 피드백을 듣고 다시 연습하며 차이를 비교할 수 있습니다.
> • 혼자 쓰는 개인 연습장과 친구와 함께 쓰는 공유 연습장을 지원합니다.
>
> 한국어, 영어, 일본어, 중국어, 스페인어, 프랑스어, 독일어, 포르투갈어, 러시아어 화면을 지원합니다.

**자세한 설명 (en)**

> ToneBridge is for friends learning each other's languages.
>
> • Turn phrases you want to learn into cards and get a voice example from a native-speaker friend.
> • Record yourself and your friend leaves feedback on your pronunciation.
> • Listen to the feedback, practice again, and compare.
> • Keep a private practice space, or share one with a friend.

**그래픽 자산** (필수)
- 앱 아이콘 512×512 PNG — ⚠️ 현재 Flutter 기본 아이콘. 3단계 전에 교체 필요
- 그래픽 이미지 1024×500
- 휴대전화 스크린샷 2장 이상 (16:9 또는 9:16, 변 320~3840px)

카테고리: 교육 · 연락처 이메일: (개발자 계정 이메일 또는 별도 지원 주소)

## 6. 비공개 테스트 운영

- 테스터는 Play 스토어 테스트 참여 링크로 **opt-in 한 뒤 앱을 설치**해야 카운트된다. 링크만 받고 참여하지 않으면 0명이다.
- 14일 동안 opt-in을 유지해야 한다. 중간에 나가면 그 테스터는 빠진다.
- 테스트 기간에도 빌드를 계속 올려도 된다(카운트는 유지). 피드백 반영 내역을 기록해 두면 프로덕션 신청 설문에 쓴다.
- 테스터 기기에서 Google 로그인이 되려면 1절 5번(앱 서명 키 SHA-1 OAuth 클라이언트)이 먼저 끝나 있어야 한다.
  이메일 로그인은 OAuth와 무관하게 동작하므로, 그 전에는 이메일 가입으로 테스트를 시작할 수 있다.

## 남은 차단 요소

| 항목 | 상태 |
|---|---|
| 처리방침·약관 페이지 | 미완 (별도 세션 카드) — Play 등록 필수 |
| 앱 아이콘 | Flutter 기본 아이콘 |
| Android 앱 표시명 `ToneBridge` | PR #89 (머지 대기) |
| 신고·차단 UI | 미완 (별도 세션 카드) — UGC 정책상 프로덕션 전 필요, 비공개 테스트는 가능 |
| Android OAuth 클라이언트 (SHA-1 2개) | Play 앱 서명 키 확정 후 |
