.PHONY: gen build run run-prod clean icons store-ios store-android

# Generate Dart code (freezed, riverpod, json_serializable, retrofit)
# Run this after:
#   - adding/modifying @freezed, @riverpod, @JsonSerializable, or @RestApi classes
#   - fresh checkout (*.g.dart and *.freezed.dart are excluded from git)
gen:
	dart run build_runner build --delete-conflicting-outputs

# Watch mode for active development
gen-watch:
	dart run build_runner watch --delete-conflicting-outputs

# Full build (codegen + flutter build)
build: gen
	flutter build apk --dart-define=BASE_URL=$$BASE_URL --dart-define=GOOGLE_CLIENT_ID=$$GOOGLE_CLIENT_ID

# Run on iOS simulator with local env vars (reads from project root .env)
# Usage: make run
run:
	@set -a; . ../$$( [ -f ../.env ] && echo .env || echo .env.example ); set +a; \
	flutter run \
	  --dart-define=GOOGLE_CLIENT_ID=$$GOOGLE_CLIENT_ID \
	  --dart-define=API_BASE_URL=https://tonebridge.mungji.com

# Run against prod API (same as run — prod is the only backend)
run-prod: run

# Store release builds (see scripts/build_store.sh)
store-ios:
	scripts/build_store.sh ios

store-android:
	scripts/build_store.sh android

clean:
	flutter clean
	dart run build_runner clean

# Regenerate app icons and the native launch screen from assets/brand
# (configs: flutter_launcher_icons.yaml, flutter_native_splash.yaml)
icons:
	dart run flutter_launcher_icons
	dart run flutter_native_splash:create
