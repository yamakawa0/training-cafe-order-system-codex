#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

find_runtime() {
  local name="$1"
  local local_bin="$ROOT_DIR/.local/bin/$name"
  if [ -f "$local_bin" ]; then
    printf '%s\n' "$local_bin"
    return 0
  fi
  command -v "$name" 2>/dev/null || true
}

check_one() {
  local name="$1"
  local bin
  bin="$(find_runtime "$name")"
  if [ -z "$bin" ]; then
    echo "NG: $name が見つかりません。README の NyanQL/Nyan8 導入手順を参照してください。"
    return 1
  fi
  if [ ! -x "$bin" ]; then
    echo "NG: $bin に実行権限がありません。chmod +x \"$bin\" を実行してください。"
    return 1
  fi
  echo "OK: $name -> $bin"
  echo "INFO: このランタイムは実行ファイル横の config.json を読むため、起動確認は start script で行います。"
}

failed=0
check_one nyanql || failed=1
check_one nyan8 || failed=1
exit "$failed"
