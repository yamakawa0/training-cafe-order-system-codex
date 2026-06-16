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

: "${DATABASE_URL:?DATABASE_URL is required}"

SOURCE_BIN="$ROOT_DIR/.local/bin/nyanql"
if [ ! -x "$SOURCE_BIN" ]; then
  SOURCE_BIN="$(command -v nyanql 2>/dev/null || true)"
fi
if [ -z "$SOURCE_BIN" ]; then
  echo "nyanql が見つかりません。README の導入手順を確認してください。" >&2
  exit 1
fi

NYANQL_PORT="${NYANQL_PORT:-8890}"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/logs}"
RUNTIME_DIR="${NYANQL_RUNTIME_DIR:-$ROOT_DIR/.local/runtime/prod-nyanql}"
PID_FILE="${NYANQL_PID_FILE:-$ROOT_DIR/.local/run/nyanql.pid}"

mkdir -p "$RUNTIME_DIR/logs" "$LOG_DIR" "$(dirname "$PID_FILE")"
cp "$SOURCE_BIN" "$RUNTIME_DIR/nyanql"
cp "$ROOT_DIR/backend/nyanql/api.json" "$RUNTIME_DIR/api.json"
rm -rf "$RUNTIME_DIR/sql"
cp -R "$ROOT_DIR/backend/nyanql/sql" "$RUNTIME_DIR/sql"
chmod +x "$RUNTIME_DIR/nyanql"

node - "$DATABASE_URL" "$NYANQL_PORT" "${NYANQL_BASIC_AUTH_USER:-nyanql}" "${NYANQL_BASIC_AUTH_PASSWORD:-change-me}" > "$RUNTIME_DIR/config.json" <<'NODE'
const [databaseUrl, port, basicUser, basicPassword] = process.argv.slice(2);
const url = new URL(databaseUrl);
const config = {
  name: "Cafe Order System NyanQL",
  profile: "production",
  version: "v1.0.0",
  Port: Number(port),
  DBType: "postgres",
  DBHost: url.hostname,
  DBPort: url.port || "5432",
  DBUser: decodeURIComponent(url.username),
  DBPassword: decodeURIComponent(url.password),
  DBName: url.pathname.replace(/^\//, ""),
  MaxOpenConnections: Number(process.env.NYANQL_MAX_OPEN_CONNECTIONS || 20),
  MaxIdleConnections: Number(process.env.NYANQL_MAX_IDLE_CONNECTIONS || 10),
  ConnMaxLifetimeSeconds: Number(process.env.NYANQL_CONN_MAX_LIFETIME_SECONDS || 300),
  BasicAuth: {
    Username: basicUser,
    Password: basicPassword
  },
  log: {
    Filename: "./logs/nyanql.log",
    MaxSize: Number(process.env.NYANQL_LOG_MAX_SIZE_MB || 20),
    MaxBackups: Number(process.env.NYANQL_LOG_MAX_BACKUPS || 10),
    MaxAge: Number(process.env.NYANQL_LOG_MAX_AGE_DAYS || 30),
    Compress: true,
    EnableLogging: true
  }
};
console.log(JSON.stringify(config, null, 2));
NODE

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "NyanQL already running: pid $(cat "$PID_FILE")" >&2
  exit 1
fi

cd "$RUNTIME_DIR"
nohup ./nyanql >> "$LOG_DIR/nyanql.stdout.log" 2>> "$LOG_DIR/nyanql.stderr.log" &
echo "$!" > "$PID_FILE"
echo "NyanQL started: pid $(cat "$PID_FILE"), port $NYANQL_PORT"
