#!/usr/bin/env bash
# ينشر التحديث على shasha-asear من جهازك (يتطلب صلاحية push على المستودع).
set -euo pipefail
BUNDLE_BRANCH="${BUNDLE_BRANCH:-cursor/shasha-asear-patches-2bd9}"
WORKDIR="${WORKDIR:-$(mktemp -d)}"
trap 'rm -rf "$WORKDIR"' EXIT

git clone --depth 1 https://github.com/Georgebahna57/shasha-asear.git "$WORKDIR/shasha"
git clone --depth 1 -b "$BUNDLE_BRANCH" https://github.com/Georgebahna57/sandouk-nemr.git "$WORKDIR/sandouk"

bash "$WORKDIR/sandouk/export/shasha-asear-update/apply.sh" "$WORKDIR/shasha"

cd "$WORKDIR/shasha"
git push origin main

echo "Done. GitHub Pages will redeploy shasha-asear shortly."
