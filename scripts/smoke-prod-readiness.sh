#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FAILED=0

ok() {
  echo "OK: $*"
}

ng() {
  echo "NG: $*" >&2
  FAILED=1
}

version_gte() {
  node - "$1" "$2" <<'NODE'
const [actual, expected] = process.argv.slice(2).map(v => String(v).replace(/^v/, "").split(".").map(Number));
for (let i = 0; i < 3; i++) {
  const a = actual[i] || 0;
  const e = expected[i] || 0;
  if (a > e) process.exit(0);
  if (a < e) process.exit(1);
}
process.exit(0);
NODE
}

require_file() {
  local path="$1"
  [ -f "$ROOT_DIR/$path" ] && ok "$path exists" || ng "$path is missing"
}

require_dir() {
  local path="$1"
  [ -d "$ROOT_DIR/$path" ] && ok "$path exists" || ng "$path is missing"
}

node_version="$(node -v 2>/dev/null || true)"
if [ -n "$node_version" ] && version_gte "$node_version" "20.19.0"; then
  ok "Node.js $node_version"
else
  ng "Node.js >=20.19 is required, actual: ${node_version:-not found}"
fi

npm_version="$(npm -v 2>/dev/null || true)"
if [ -n "$npm_version" ] && version_gte "$npm_version" "10.0.0"; then
  ok "npm $npm_version"
else
  ng "npm >=10 is required, actual: ${npm_version:-not found}"
fi

require_file "frontend/dist/index.html"
require_dir "frontend/dist/assets"

if (cd "$ROOT_DIR/frontend" && npm audit --audit-level=high >/tmp/cafe-order-system-npm-audit.log 2>&1); then
  ok "npm audit high/critical 0"
else
  cat /tmp/cafe-order-system-npm-audit.log >&2 || true
  ng "npm audit --audit-level=high failed"
fi

env_source=""
if [ -f "$ROOT_DIR/.env.production" ]; then
  env_source="$ROOT_DIR/.env.production"
elif [ -f "$ROOT_DIR/.env.production.example" ]; then
  env_source="$ROOT_DIR/.env.production.example"
fi

if [ -n "$env_source" ]; then
  ok "$(basename "$env_source") exists"
  for key in DATABASE_URL NYANQL_HOST NYANQL_PORT NYAN8_HOST NYAN8_PORT APP_BASE_URL SESSION_COOKIE_NAME SESSION_TTL_SECONDS COOKIE_SECURE COOKIE_SAMESITE LOG_DIR; do
    if grep -Eq "^${key}=.+" "$env_source"; then
      ok "$key is present"
    else
      ng "$key is missing in $(basename "$env_source")"
    fi
  done
else
  ng ".env.production or .env.production.example is missing"
fi

if [ -x "$ROOT_DIR/.local/bin/nyanql" ] || command -v nyanql >/dev/null 2>&1; then
  ok "nyanql executable found"
else
  ng "nyanql executable not found"
fi

if [ -x "$ROOT_DIR/.local/bin/nyan8" ] || command -v nyan8 >/dev/null 2>&1; then
  ok "nyan8 executable found"
else
  ng "nyan8 executable not found"
fi

require_file "deploy/nginx/cafe-order-system.conf.example"

grep -q "本番相当デプロイ準備" "$ROOT_DIR/README.md" && ok "README production section exists" || ng "README production section missing"
grep -q "Phase 9: 本番デプロイ準備" "$ROOT_DIR/docs/07_development_plan.md" && ok "development plan has Phase 9" || ng "Phase 9 missing in development plan"
grep -q "本番 readiness smoke" "$ROOT_DIR/docs/06_acceptance_criteria.md" && ok "acceptance criteria has production readiness smoke" || ng "production readiness criteria missing"

if [ "$FAILED" -eq 0 ]; then
  echo
  echo "PASS: production readiness smoke"
else
  echo
  echo "FAIL: production readiness smoke" >&2
fi

exit "$FAILED"
