#!/usr/bin/env bash
#
# 릴리스 헬퍼 — CHANGELOG.md의 해당 버전 섹션을 GitHub 릴리스 노트로 발행한다.
#
# ── 사용 전 (수동) ──────────────────────────────────────────────
#   1) CHANGELOG.md 에 새 버전 섹션 작성:
#        ## [X.Y.Z] - YYYY-MM-DD
#        ### Added / Changed / Fixed / Security ...
#      그리고 파일 맨 아래 compare 링크 추가:
#        [X.Y.Z]: https://github.com/<owner>/<repo>/compare/vW...vX.Y.Z
#   2) README 버전 히스토리 표에 한 줄 추가
#        ⚠️ TimeManager 는 루트 README.md 가 아니라 .github/README.md 를 수정!
#   3) 위 문서 변경을 커밋 (예: git commit -am "docs: release vX.Y.Z")
#
# ── 실행 ────────────────────────────────────────────────────────
#   ./scripts/release.sh X.Y.Z "짧은 테마 문구"
#
# 하는 일: 태그 생성(annotated) → 브랜치+태그 push → gh 릴리스 생성(--latest)
# 배포 CI 는 브랜치 push 로 이미 돌며, 태그 push 자체는 배포를 트리거하지 않는다.
#
set -euo pipefail

VER="${1:-}"
THEME="${2:-}"
if [ -z "$VER" ]; then
  echo "사용법: ./scripts/release.sh <version> [theme]   예) ./scripts/release.sh 0.7.0 \"검색 개선 · 알림\"" >&2
  exit 1
fi
TAG="v$VER"
cd "$(git rev-parse --show-toplevel)"

command -v gh >/dev/null || { echo "✗ GitHub CLI(gh)가 필요합니다: https://cli.github.com/" >&2; exit 1; }
[ -f CHANGELOG.md ] || { echo "✗ CHANGELOG.md 가 없습니다." >&2; exit 1; }

# 1) CHANGELOG 에서 해당 버전 섹션만 추출 (다음 '## [' 또는 링크 정의부 직전까지)
NOTES="$(awk -v h="## [$VER]" '
  substr($0,1,length(h))==h {f=1; next}
  f && (/^## \[/ || /^\[[^]]+\]: /) {exit}
  f' CHANGELOG.md)"
if [ -z "$(printf '%s' "$NOTES" | tr -d '[:space:]')" ]; then
  echo "✗ CHANGELOG.md 에 '## [$VER]' 섹션이 없습니다. 먼저 작성하세요." >&2
  exit 1
fi

# 2) 사전 조건 검증
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "✗ 태그 $TAG 가 이미 존재합니다." >&2; exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "✗ 커밋되지 않은 변경이 있습니다. CHANGELOG/README 를 먼저 커밋하세요:" >&2
  git status --short >&2; exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
TITLE="$TAG"; [ -n "$THEME" ] && TITLE="$TAG — $THEME"

echo "→ 릴리스: $TAG   (branch=$BRANCH, title=\"$TITLE\")"
git tag -a "$TAG" -m "$TITLE"
git push origin "$BRANCH"
git push origin "$TAG"
gh release create "$TAG" --title "$TITLE" --notes "$NOTES" --latest
echo "✓ 완료 → $(gh repo view --json url -q .url)/releases/tag/$TAG"
