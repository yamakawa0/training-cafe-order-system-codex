#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"

if [ ! -f "$ENV_FILE" ]; then
  echo "$ENV_FILE がありません。.env.production.example をコピーして設定してください。" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

SOURCE_BIN="$ROOT_DIR/.local/bin/nyan8"
if [ ! -x "$SOURCE_BIN" ]; then
  SOURCE_BIN="$(command -v nyan8 2>/dev/null || true)"
fi
if [ -z "$SOURCE_BIN" ]; then
  echo "nyan8 が見つかりません。README の導入手順を確認してください。" >&2
  exit 1
fi

NYAN8_PORT="${NYAN8_PORT:-8889}"
NYANQL_BASE_URL="${NYANQL_BASE_URL:-http://127.0.0.1:${NYANQL_PORT:-8890}}"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/logs}"
RUNTIME_DIR="${NYAN8_RUNTIME_DIR:-$ROOT_DIR/.local/runtime/prod-nyan8}"
PID_FILE="${NYAN8_PID_FILE:-$ROOT_DIR/.local/run/nyan8.pid}"

mkdir -p "$RUNTIME_DIR/logs" "$LOG_DIR" "$(dirname "$PID_FILE")"
cp "$SOURCE_BIN" "$RUNTIME_DIR/nyan8"
cp "$ROOT_DIR/backend/nyan8/api.json" "$RUNTIME_DIR/api.json"
rm -rf "$RUNTIME_DIR/javascript"
cp -R "$ROOT_DIR/backend/nyan8/javascript" "$RUNTIME_DIR/javascript"
chmod +x "$RUNTIME_DIR/nyan8"

node - "$ROOT_DIR/backend/nyan8/config.json" "$NYAN8_PORT" > "$RUNTIME_DIR/config.json" <<'NODE'
const fs = require("fs");
const [configPath, port] = process.argv.slice(2);
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
config.profile = "production";
config.Port = Number(port);
config.log = {
  Filename: "./logs/nyan8.log",
  MaxSize: Number(process.env.NYAN8_LOG_MAX_SIZE_MB || 20),
  MaxBackups: Number(process.env.NYAN8_LOG_MAX_BACKUPS || 10),
  MaxAge: Number(process.env.NYAN8_LOG_MAX_AGE_DAYS || 30),
  Compress: true,
  EnableLogging: true
};
console.log(JSON.stringify(config, null, 2));
NODE

node - "$RUNTIME_DIR/javascript/lib/runtime.js" "$NYANQL_BASE_URL" "${NYANQL_BASIC_AUTH_USER:-nyanql}" "${NYANQL_BASIC_AUTH_PASSWORD:-change-me}" <<'NODE'
const fs = require("fs");
const [runtimePath, baseUrl, user, password] = process.argv.slice(2);
let text = fs.readFileSync(runtimePath, "utf8");
text = text
  .replace(/var NYANQL_BASE_URL = ".*?";/, `var NYANQL_BASE_URL = ${JSON.stringify(baseUrl)};`)
  .replace(/var NYANQL_USER = ".*?";/, `var NYANQL_USER = ${JSON.stringify(user)};`)
  .replace(/var NYANQL_PASSWORD = ".*?";/, `var NYANQL_PASSWORD = ${JSON.stringify(password)};`);
fs.writeFileSync(runtimePath, text);
NODE

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Nyan8 already running: pid $(cat "$PID_FILE")" >&2
  exit 1
fi

cd "$RUNTIME_DIR"
nohup ./nyan8 >> "$LOG_DIR/nyan8.stdout.log" 2>> "$LOG_DIR/nyan8.stderr.log" &
echo "$!" > "$PID_FILE"
echo "Nyan8 started: pid $(cat "$PID_FILE"), port $NYAN8_PORT"
