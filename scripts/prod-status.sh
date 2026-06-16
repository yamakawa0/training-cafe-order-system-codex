#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

RUN_DIR="${RUN_DIR:-$ROOT_DIR/.local/run}"
NYANQL_PORT="${NYANQL_PORT:-8890}"
NYAN8_PORT="${NYAN8_PORT:-8889}"

status_one() {
  local name="$1"
  local port="$2"
  local pid_file="$RUN_DIR/$name.pid"
  if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
    echo "OK: $name pid $(cat "$pid_file")"
  else
    echo "NG: $name pid not running"
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN || true
  else
    echo "INFO: lsof is not available; skipped port check for $port"
  fi
}

status_one nyanql "$NYANQL_PORT"
status_one nyan8 "$NYAN8_PORT"
