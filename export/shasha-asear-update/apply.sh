#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-}"

if [[ -z "$TARGET" ]]; then
  if [[ -d "./.git" ]] && git remote get-url origin 2>/dev/null | grep -q shasha-asear; then
    TARGET="$(pwd)"
  else
    echo "Usage: $0 /path/to/shasha-asear"
    echo "Or run from a shasha-asear clone directory."
    exit 1
  fi
fi

TARGET="$(cd "$TARGET" && pwd)"
echo "Updating: $TARGET"
cp -a "$ROOT/.github" "$TARGET/" 2>/dev/null || mkdir -p "$TARGET/.github/workflows" && cp "$ROOT/.github/workflows/pages.yml" "$TARGET/.github/workflows/"
cp -a "$ROOT/docs" "$TARGET/"
cp -a "$ROOT/supabase" "$TARGET/"
for f in .gitignore COPY-TO-GITHUB.md README.md index.html relay-config.json.example relay-publish.ps1 relay.json.example start-board.bat start-board.ps1; do
  cp "$ROOT/$f" "$TARGET/$f"
done

cd "$TARGET"
if git diff --quiet && git diff --cached --quiet; then
  echo "No changes to commit."
  exit 0
fi
git add -A
git status
git commit -m "مزامنة MT5 للموبايل والتلفزيون + واجهة عربية"
echo "Run: git push origin main"
