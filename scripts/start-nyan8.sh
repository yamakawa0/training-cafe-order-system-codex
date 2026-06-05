#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_BIN="$ROOT_DIR/.local/bin/nyan8"
if [ ! -x "$SOURCE_BIN" ]; then
  SOURCE_BIN="$(command -v nyan8 2>/dev/null || true)"
fi
if [ -z "$SOURCE_BIN" ]; then
  echo "nyan8 が見つかりません。./scripts/check-runtime.sh と README の導入手順を確認してください。" >&2
  exit 1
fi

RUNTIME_DIR="$ROOT_DIR/.local/runtime/nyan8"
mkdir -p "$RUNTIME_DIR/logs"
cp "$SOURCE_BIN" "$RUNTIME_DIR/nyan8"
cp "$ROOT_DIR/backend/nyan8/config.json" "$RUNTIME_DIR/config.json"
cp "$ROOT_DIR/backend/nyan8/api.json" "$RUNTIME_DIR/api.json"
rm -rf "$RUNTIME_DIR/javascript"
cp -R "$ROOT_DIR/backend/nyan8/javascript" "$RUNTIME_DIR/javascript"
chmod +x "$RUNTIME_DIR/nyan8"
cd "$RUNTIME_DIR"
exec ./nyan8
