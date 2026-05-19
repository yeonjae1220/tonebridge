.PHONY: gen build run run-prod clean

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

clean:
	flutter clean
	dart run build_runner clean
