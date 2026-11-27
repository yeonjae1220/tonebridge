# iOS — App Store Connect 제출 자료 (5단계)

기준일: 2026-11-25 · 번들 ID `com.mungji.tonebridge` · iPhone 전용 · iOS 15+
Android 쪽은 [android-play.md](android-play.md), 실기기 확인은 [device-qa.md](device-qa.md).

## 1. 제출 순서 (사람이 하는 일 포함)

| # | 할 일 | 비고 |
|---|---|---|
| 1 | Certificates, IDs & Profiles → App ID `com.mungji.tonebridge`에 **Sign in with Apple** 켜기 | 안 켜면 TestFlight 빌드에서 Apple 로그인이 실패한다 |
| 2 | App Store Connect → 새 앱: 이름 `ToneBridge`, 기본 언어 한국어, 번들 ID 선택, SKU `tonebridge-ios` | 이름이 이미 쓰이고 있으면 `ToneBridge: 친구와 발음 연습` 처럼 부제를 붙인 이름으로 |
| 3 | Mac에서 `make store-ios` → `build/ios/ipa/*.ipa` | 빌드 번호 = 커밋 수 |
| 4 | Transporter 앱(또는 Xcode Organizer)으로 업로드 | App Store Connect API 키를 주면 `xcrun altool` 로 자동화 가능 |
| 5 | TestFlight 내부 테스트 → [device-qa.md](device-qa.md) 실기기 확인 | 내부 테스터는 심사 없이 바로 설치 |
| 6 | 아래 2~6절 내용 입력, 스크린샷 업로드 | |
| 7 | **Apple 토큰 revoke 구현 후** 심사 제출 | 가이드라인 5.1.1(v) — 계정 삭제 시 Apple 로그인 연결 해제. .p8 키·Key ID·Team ID 필요 |

## 2. 앱 정보

| 항목 | 값 |
|---|---|
| 이름 (30자) | ToneBridge |
| 부제 ko (30자) | 친구와 주고받는 발음 연습 |
| 부제 en | Practice languages with friends |
| 카테고리 | 교육 (보조: 참고) |
| 지원 URL | https://tonebridge.mungji.com/help |
| 마케팅 URL | https://tonebridge.mungji.com |
| 개인정보처리방침 URL | https://tonebridge.mungji.com/privacy (한국어 기본, `?lang=en` 영어) |
| 가격 | 무료, 앱 내 구입 없음 |
| 저작권 | © 2026 mungji |

**키워드 ko** (100자, 쉼표 구분, 공백 없이)
`언어교환,발음,발음교정,외국어,회화,스피킹,영어,일본어,중국어,녹음,피드백,친구,연습,한국어`

**키워드 en**
`language exchange,pronunciation,speaking,tandem,feedback,voice,practice,korean,japanese,english`

**프로모션 텍스트 ko** (170자, 심사 없이 수정 가능)
친구가 보내 준 원어민 발음을 듣고, 내 목소리로 따라 해 보세요. 피드백을 받고 다시 연습하며 차이를 비교할 수 있어요.

**설명**: [android-play.md 5절](android-play.md#5-스토어-등록정보-초안)의 자세한 설명(ko/en)을 그대로 쓴다 — 두 스토어 문구를 일치시킨다.

## 3. 앱 개인정보 보호 (Privacy Nutrition Label)

추적(Tracking): **아니요** — 광고·분석 SDK 없음, 다른 회사 데이터와 결합하지 않음.

| 데이터 유형 | 수집 | 사용자와 연결 | 목적 |
|---|---|---|---|
| 연락처 정보 → 이메일 주소 | 예 | 예 | 앱 기능 (계정) |
| 사용자 콘텐츠 → 오디오 데이터 | 예 | 예 | 앱 기능 |
| 사용자 콘텐츠 → 기타 사용자 콘텐츠 (문장·카드·피드백·신고 내용) | 예 | 예 | 앱 기능 |
| 사용자 콘텐츠 → 고객 지원 (문의 내용) | 예 | 예 | 앱 기능 (지원) |
| 식별자 → 사용자 ID (내부 ID·Apple 사용자 식별자) | 예 | 예 | 앱 기능 |
| 기타 데이터 (모국어·학습 언어·화면 언어) | 예 | 예 | 앱 기능 |
| 위치·연락처·사진·건강·금융·검색 기록·구매 | 아니요 | — | — |
| 진단 (크래시·성능) | 아니요 | — | 크래시 수집 SDK 없음 |

- 처리방침(#94) 본문과 대조함(2026-11-27). 이름·프로필 사진은 Google·Apple 로그인 모두 저장하지 않는다.
- ⚠️ 파일럿 검증 수집(`TONEBRIDGE_VALIDATION_ENABLED`)을 운영에서 켜면 "사용 데이터 → 제품 상호작용"을 추가해야 한다. 운영 k8s 값 `"false"`(2026-11-27 `k8s/backend.yaml` 확인).
- ⚠️ 사람이 판단할 것: 로그인 시도 제한·서버 운영 기록에 IP 주소가 남는다. 보안 목적으로만 쓰고 위치 추정에 쓰지 않아 별도 항목으로 넣지 않았다.
- ⚠️ Play 데이터 보안 양식([android-play.md 3절](android-play.md#3-데이터-보안-양식-data-safety))과 처리방침 본문이 이 표와 같아야 한다.

## 4. 연령 등급 설문

App Store Connect가 답변으로 등급을 계산한다. 예상 답변:

| 항목 | 답 |
|---|---|
| 폭력·성적 콘텐츠·약물·도박·공포 등 콘텐츠 항목 | 없음 |
| 사용자 생성 콘텐츠 | **예** |
| 사용자 간 메시지·채팅 | **예** (친구 간 피드백·메모) |
| 제한 없는 웹 접근 | 아니요 (인앱 브라우저는 자사 약관·처리방침만) |
| 광고 | 아니요 |
| 연령 확인·보호자 통제 | 없음 |

UGC 앱은 신고·차단·이용약관(무관용 조항)·운영자 연락 수단이 모두 있어야 한다(가이드라인 1.2).
신고·차단은 앱·웹·백엔드 모두 머지됨. 약관 무관용 조항과 24시간 검토 약속은 #94에 있다 — **#94가 배포되고 신고 알림 메일(`REPORT_ALERT_TO`)이 오는 것을 확인하기 전에는 제출하지 않는다.**

## 5. 심사 노트 (App Review Information)

로그인 정보: **심사 전용 계정 2개**를 운영 DB에 만들어 친구로 연결하고, 공유 연습장에 샘플 카드·음성·피드백을 넣어 둔다.
계정이 하나면 친구 기능(앱의 핵심)을 심사자가 볼 수 없다.

노트 초안 (en):

> ToneBridge lets friends who are learning each other's languages exchange phrases, voice examples and pronunciation feedback.
>
> Sign in: tap "Continue with email" and use the demo account below. Sign in with Apple and Google are also available.
> A second demo account is already this account's friend, with a shared practice space containing sample cards, voice recordings and feedback.
>
> Microphone: used only to record pronunciation practice and voice cards, when the user taps the record button.
> Account deletion: Profile → Settings → Delete account.
> Reporting / blocking: Friends tab → ⋮ next to a friend or a friend request → Report user / Block. Inside a shared notebook card someone else wrote: ⋮ in the top bar → Report content / Block author; the flag icon on another person's example recording or on feedback reports that item. The report form can also block the author in the same step. Blocked users: Profile → Settings → Blocked users (unblock there). Reports reach the operator console immediately and are reviewed within 24 hours; the operator can remove content or the account.
>
> Demo account: (email) / (password)

연락처: 이름·전화·이메일은 개발자 본인 정보로 입력.

## 6. 스크린샷

iPad를 지원하지 않으므로(`TARGETED_DEVICE_FAMILY = 1`) **iPhone 6.9" 한 세트만** 필수다.
시뮬레이터 `iPhone 18 Pro Max`에서 찍으면 규격에 맞는 해상도가 그대로 나온다. 같은 세트를 Play 휴대전화 스크린샷으로도 쓴다.

| # | 화면 | 보여 줄 것 |
|---|---|---|
| 1 | 로그인 | 브랜드·한 줄 소개, 로그인 3종 |
| 2 | 학습 홈 (연습장 목록) | 개인·공유 연습장 |
| 3 | 카드 상세 | 문장 + 친구의 예시 음성 + 내 시도 |
| 4 | 녹음 중 | 녹음 UI |
| 5 | 피드백 | 친구가 남긴 피드백과 다시 연습 |
| 6 | 친구 | 친구 목록·요청 |

샘플 데이터는 심사 전용 계정(5절)의 내용으로 찍는다 — 실제 사용자 데이터가 화면에 나오면 안 된다.
문구를 얹은 마케팅 이미지로 만들지는 선택. 기본은 실제 화면 그대로.

## 제출 전 남은 차단 요소

| 항목 | 상태 |
|---|---|
| 개인정보처리방침·이용약관 페이지 | 완료 — `/privacy`, `/terms` (#94). 연락처 support@mungji.com 수신 설정은 사람이 할 일 |
| 신고·차단 UI | 완료 (앱·웹·백엔드) — 운영 k8s `REPORT_ALERT_TO`·`MAIL_FROM` 설정 필요 |
| Apple 토큰 revoke (계정 삭제 시) | 미구현 — .p8 키 필요 |
| App ID에 Sign in with Apple 켜기 | 사람이 할 일 (1절) |
| 최종 앱 아이콘 | 임시 브랜드 아이콘(#91) 사용 중 |
| 심사 전용 계정 2개 + 샘플 데이터 | 미생성 |
| 실기기 QA | [device-qa.md](device-qa.md) |
