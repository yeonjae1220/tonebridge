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

```bash
# flutterfire CLI 설치
dart pub global activate flutterfire_cli

# Firebase 프로젝트 연결 (기존 langcorrect 프로젝트 사용)
flutterfire configure --project=<FIREBASE_PROJECT_ID>
```

이 명령이 `lib/firebase_options.dart`를 자동 생성합니다.

### 플랫폼별 추가 설정

**Android:**
- `android/app/google-services.json` 자동 생성됨 (flutterfire 실행 후)
- `android/app/build.gradle`에 `apply plugin: 'com.google.gms.google-services'` 확인

**iOS:**
- `ios/Runner/GoogleService-Info.plist` 자동 생성됨
- Xcode에서 Bundle ID = `me.yeonjae.tonebridge` 확인

## 5. 환경 변수 설정

```bash
# 개발 환경 (Android 에뮬레이터)
flutter run \
  --dart-define=BASE_URL=http://10.0.2.2:8080 \
  --dart-define=OAUTH_REDIRECT_URI=tonebridge://oauth/callback

# 스테이징/프로덕션
flutter run --release \
  --dart-define=BASE_URL=https://api.tonebridge.app \
  --dart-define=OAUTH_REDIRECT_URI=tonebridge://oauth/callback
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
├── firebase_options.dart  # flutterfire generate (gitignore)
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
