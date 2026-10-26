#!/usr/bin/env bash
# Copies ./crewliworkers.png into every mipmap-*dpi folder as
# ic_launcher.png and ic_launcher_round.png so the Android launcher icon
# reflects the Crewli Workers brand.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/crewliworkers.png"

if [ ! -f "$SRC" ]; then
  echo "Missing $SRC"
  exit 1
fi

RES="$ROOT/android/app/src/main/res"
for d in mipmap-mdpi mipmap-hdpi mipmap-xhdpi mipmap-xxhdpi mipmap-xxxhdpi; do
  mkdir -p "$RES/$d"
  cp "$SRC" "$RES/$d/ic_launcher.png"
  cp "$SRC" "$RES/$d/ic_launcher_round.png"
  echo "  -> $RES/$d"
done

echo
echo "Done. Rebuild with: cd workers-app && npm run android"
