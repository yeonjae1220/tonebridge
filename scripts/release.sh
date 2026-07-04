#!/usr/bin/env bash
#
# 릴리스 헬퍼 — CHANGELOG.md의 해당 버전 섹션을 GitHub 릴리스 노트로 발행한다.
#
# ── 다음 버전이 뭔지 모를 때 (판단 도우미) ──────────────────────
#   ./scripts/release.sh --suggest
#     최신 태그 이후 커밋을 분석해 올릴 버전(MINOR/PATCH)을 추천한다.
#     기준:  feat 커밋 1개+  → MINOR (하위호환 새 기능)
#            fix/perf/security만 → PATCH
#            docs/chore/refactor만 → 릴리스 불필요
#            파괴적 변경이 있어도 0.x / snapguide(앱-실용주의)는 MINOR로 흡수
#
# ── 실제 릴리스 (사용 전 수동 3단계) ────────────────────────────
#   1) CHANGELOG.md 에 새 버전 섹션 작성:
#        ## [X.Y.Z] - YYYY-MM-DD
#        ### Added / Changed / Fixed / Security ...
#      그리고 파일 맨 아래 compare 링크 추가:
#        [X.Y.Z]: https://github.com/<owner>/<repo>/compare/vW...vX.Y.Z
#   2) README 버전 히스토리 표에 한 줄 추가
#        ⚠️ TimeManager 는 루트 README.md 가 아니라 .github/README.md 를 수정!
#   3) 위 문서 변경을 커밋 (예: git commit -am "docs: release vX.Y.Z")
#
#   그 뒤:  ./scripts/release.sh X.Y.Z "짧은 테마 문구"
#
# 하는 일: 태그 생성(annotated) → 브랜치+태그 push → gh 릴리스 생성(--latest)
# 배포 CI 는 브랜치 push 로 돌며, 태그 push 자체는 배포를 트리거하지 않는다.
#
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

suggest() {
  local last range n feat fixish brk base M rest m p bump next
  last="$(git describe --tags --abbrev=0 2>/dev/null || true)"
  if [ -z "$last" ]; then
    echo "태그가 하나도 없습니다 → 첫 릴리스로 v0.1.0 을 권장합니다."
    return 0
  fi
  range="$last..HEAD"
  n=$(git rev-list --count "$range")
  feat=$(git log "$range" --format='%s' | grep -cE '^feat' || true)
  fixish=$(git log "$range" --format='%s' | grep -cE '^(fix|perf|security|revert)' || true)
  brk=$(git log "$range" --format='%s%x00%b' | grep -cE '(^[a-z]+(\([^)]*\))?!:)|BREAKING CHANGE' || true)
  base=${last#v}; M=${base%%.*}; rest=${base#*.}; m=${rest%%.*}; p=${rest#*.}
  if   [ "$feat"   -gt 0 ]; then bump=MINOR; next="$M.$((m+1)).0"
  elif [ "$fixish" -gt 0 ]; then bump=PATCH; next="$M.$m.$((p+1))"
  else bump=NONE; next=""; fi

  echo "현재 최신 태그 : $last"
  echo "이후 커밋      : ${n}개  (feat ${feat} · fix/perf/security ${fixish} · breaking ${brk})"
  if [ "$bump" = NONE ]; then
    echo "권장           : 릴리스 불필요 — 사용자 대상 변경(feat/fix)이 없습니다."
  else
    echo "권장 버전      : v${next}   (${bump} 업)"
    [ "$brk" -gt 0 ] && echo "               ⚠ 파괴적 변경 ${brk}건 감지 — 0.x/앱-실용주의 정책상 MINOR로 흡수(MAJOR 승격 안 함)"
  fi
  echo
  echo "── ${range} 커밋 ──"
  git log "$range" --format='  %h %s'
}

VER="${1:-}"
THEME="${2:-}"

case "$VER" in
  --suggest|suggest) suggest; exit 0 ;;
  "" ) echo "사용법:"
       echo "  ./scripts/release.sh --suggest              # 다음 버전 추천"
       echo "  ./scripts/release.sh X.Y.Z \"테마 문구\"       # 릴리스 실행"
       exit 1 ;;
esac

TAG="v$VER"
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
