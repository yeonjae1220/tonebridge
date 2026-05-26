# ToneBridge Mobile — Setup Guide

## 1. Flutter SDK 설치

```bash
# Homebrew로 설치 (macOS)
brew install --cask flutter

# 또는 공식 설치
# https://docs.flutter.dev/get-started/install/macos

# 설치 확인
flutter doctor
```

## 2. 의존성 설치

```bash
cd ToneBridge/mobile
flutter pub get
```

## 3. 코드 생성 (Riverpod, Freezed, Retrofit)

```bash
flutter pub run build_runner build --delete-conflicting-outputs
```

## 4. Firebase 설정

`lib/firebase_options.dart`는 이미 커밋돼 있어 별도 생성이 필요 없다.
웹 플랫폼 config는 포함되어 있으며, Android/iOS는 `REPLACE_ME` 상태다.

### Android/iOS 네이티브 배포 시

```bash
# flutterfire CLI 설치
dart pub global activate flutterfire_cli

# Firebase 프로젝트 연결 (프로젝트 ID: tonebridge-44c8a)
flutterfire configure --project=tonebridge-44c8a
```

이 명령이 `firebase_options.dart`의 Android/iOS 값을 채우고
`android/app/google-services.json`, `ios/Runner/GoogleService-Info.plist`를 생성한다.
두 파일은 `.gitignore`에 포함되어 있으므로 커밋하지 않는다.

### 웹 FCM 푸시 알림 (VAPID key)

VAPID key는 Firebase Console → Project Settings → Cloud Messaging → Web Push certificates에서 확인한다.
빌드 시 `--dart-define=VAPID_KEY=<key>` 로 주입한다.

## 5. 환경 변수 설정

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `API_BASE_URL` | 백엔드 API 주소 | `http://10.0.2.2:8080` |
| `GOOGLE_CLIENT_ID` | Google OAuth Web 클라이언트 ID | (필수) |
| `FIREBASE_CONFIGURED` | Firebase 초기화 여부 | `false` |
| `VAPID_KEY` | FCM 웹 푸시 VAPID 키 | (웹 푸시 사용 시 필수) |

```bash
# 웹 개발
flutter run -d chrome \
  --dart-define=API_BASE_URL=http://localhost:8080 \
  --dart-define=GOOGLE_CLIENT_ID=<web-client-id> \
  --dart-define=FIREBASE_CONFIGURED=true \
  --dart-define=VAPID_KEY=<vapid-key>

# Android 에뮬레이터
flutter run -d emulator \
  --dart-define=API_BASE_URL=http://10.0.2.2:8080 \
  --dart-define=GOOGLE_CLIENT_ID=<web-client-id>

# iOS 시뮬레이터
flutter run -d simulator \
  --dart-define=API_BASE_URL=http://localhost:8080 \
  --dart-define=GOOGLE_CLIENT_ID=<web-client-id>
```

## 6. Deep Link 설정 (OAuth Callback)

### Android — `android/app/src/main/AndroidManifest.xml`

```xml
<activity ...>
  <intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="tonebridge" android:host="oauth" />
  </intent-filter>
</activity>
```

### iOS — `ios/Runner/Info.plist`

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>tonebridge</string>
    </array>
  </dict>
</array>
```

## 7. Spring Boot 백엔드 OAuth 설정

`application.yml` 또는 환경 변수에서 모바일 redirect URI를 설정:

```yaml
tonebridge:
  auth:
    redirect-uri: http://localhost:8080/api/auth/google/callback # Web
    mobile-redirect-uri: tonebridge://oauth/callback             # Mobile
```

운영/개발 환경 변수로는 `GOOGLE_REDIRECT_URI`, `GOOGLE_MOBILE_REDIRECT_URI`를 사용합니다.

## 8. 앱 실행

```bash
# 디버그 빌드
flutter run

# 릴리즈 빌드 (실기기)
flutter run --release

# 특정 디바이스
flutter devices
flutter run -d <device_id>
```

## 프로젝트 구조

```
lib/
├── main.dart              # 진입점 (Firebase 초기화, 글로벌 에러 핸들러)
├── app.dart               # ToneBridgeApp (MaterialApp.router)
├── firebase_options.dart  # 웹 config 포함, Android/iOS는 flutterfire configure 필요
├── core/
│   ├── config/
│   │   └── app_config.dart          # 컴파일타임 환경변수
│   ├── network/
│   │   ├── dio_client.dart          # Dio 팩토리
│   │   └── auth_interceptor.dart    # 401 인터셉터 + 큐 패턴
│   ├── storage/
│   │   └── secure_storage_service.dart  # flutter_secure_storage 래퍼
│   ├── router/
│   │   └── app_router.dart          # GoRouter + refreshListenable
│   └── providers/
│       └── core_providers.dart      # 전역 Riverpod 프로바이더
└── features/
    ├── auth/
    │   ├── domain/
    │   │   ├── model/user.dart       # Freezed 모델
    │   │   └── auth_repository.dart  # 포트 인터페이스
    │   ├── data/
    │   │   ├── dto/auth_response.dart
    │   │   └── auth_repository_impl.dart
    │   └── presentation/
    │       ├── auth_provider.dart    # AuthState (Riverpod AsyncNotifier)
    │       ├── login_page.dart
    │       └── onboarding/
    │           ├── onboarding_page.dart
    │           └── language_select_page.dart
    ├── correction/           # Phase 6 이후 구현
    └── notification/
        ├── notification_service.dart     # FCM
        └── sse_notification_service.dart # SSE 실시간 알림
```
