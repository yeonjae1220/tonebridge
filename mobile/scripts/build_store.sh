#!/usr/bin/env bash
# Store release build for ToneBridge.
#
#   scripts/build_store.sh ios       # → build/ios/ipa/*.ipa   (Mac, Xcode signing)
#   scripts/build_store.sh android   # → build/app/outputs/bundle/release/app-release.aab (gpunode, upload key)
#
# Points the app at production, takes GOOGLE_CLIENT_ID from the repo-root .env (it is kept
# out of git like the other deploy secrets), and stamps a build number that only goes up:
# the commit count of HEAD. Builds must come from a clean, pushed main so a build number
# always maps to one commit. Set ALLOW_DIRTY=1 to override for a local test build.
set -euo pipefail

platform="${1:-}"
case "$platform" in
  ios|android) ;;
  *) echo "usage: $0 ios|android" >&2; exit 2 ;;
esac

cd "$(dirname "$0")/.."
repo_root="$(git rev-parse --show-toplevel)"

if [[ "${ALLOW_DIRTY:-0}" != 1 ]] && [[ -n "$(git status --porcelain)" ]]; then
  echo "error: working tree is not clean (ALLOW_DIRTY=1 to build anyway)" >&2
  exit 1
fi

if [[ -f "$repo_root/.env" ]]; then
  set -a; . "$repo_root/.env"; set +a
fi
if [[ -z "${GOOGLE_CLIENT_ID:-}" ]]; then
  echo "error: GOOGLE_CLIENT_ID is not set (repo-root .env or environment)" >&2
  exit 1
fi

build_number="$(git rev-list --count HEAD)"
flutter_cmd=(flutter)
command -v fvm >/dev/null && flutter_cmd=(fvm flutter)

defines=(
  --dart-define=API_BASE_URL=https://tonebridge.mungji.com
  --dart-define=WEB_BASE_URL=https://tonebridge.mungji.com
  --dart-define="GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID"
)
# Symbols for crash reports stay out of the app and out of git (build/ is ignored).
obfuscation=(--obfuscate --split-debug-info="build/debug-info/$platform-$build_number")

"${flutter_cmd[@]}" pub get
dart_cmd=(dart); command -v fvm >/dev/null && dart_cmd=(fvm dart)
"${dart_cmd[@]}" run build_runner build

if [[ "$platform" == android ]]; then
  # Without key.properties Gradle silently produces an unsigned bundle Play rejects.
  if [[ ! -f android/key.properties ]]; then
    echo "error: android/key.properties missing — Android store builds run on gpunode (upload key)" >&2
    exit 1
  fi
  "${flutter_cmd[@]}" build appbundle --release --build-number="$build_number" "${defines[@]}" "${obfuscation[@]}"
  echo "built build/app/outputs/bundle/release/app-release.aab (build $build_number)"
else
  "${flutter_cmd[@]}" build ipa --release --build-number="$build_number" "${defines[@]}" "${obfuscation[@]}"
  echo "built build/ios/ipa (build $build_number) — upload with Xcode Organizer or Transporter"
fi
