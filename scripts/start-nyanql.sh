#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_BIN="$ROOT_DIR/.local/bin/nyanql"
if [ ! -x "$SOURCE_BIN" ]; then
  SOURCE_BIN="$(command -v nyanql 2>/dev/null || true)"
fi
if [ -z "$SOURCE_BIN" ]; then
  echo "nyanql が見つかりません。./scripts/check-runtime.sh と README の導入手順を確認してください。" >&2
  exit 1
fi

RUNTIME_DIR="$ROOT_DIR/.local/runtime/nyanql"
mkdir -p "$RUNTIME_DIR/logs"
cp "$SOURCE_BIN" "$RUNTIME_DIR/nyanql"
cp "$ROOT_DIR/backend/nyanql/config.json" "$RUNTIME_DIR/config.json"
cp "$ROOT_DIR/backend/nyanql/api.json" "$RUNTIME_DIR/api.json"
rm -rf "$RUNTIME_DIR/sql"
cp -R "$ROOT_DIR/backend/nyanql/sql" "$RUNTIME_DIR/sql"
chmod +x "$RUNTIME_DIR/nyanql"
cd "$RUNTIME_DIR"
exec ./nyanql
