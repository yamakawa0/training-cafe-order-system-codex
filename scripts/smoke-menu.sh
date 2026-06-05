#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATABASE_URL="${DATABASE_URL:-postgres://codex:codex@localhost:5432/cafe_order_system}"
NYANQL_BASE_URL="${NYANQL_BASE_URL:-http://localhost:8890}"
NYANQL_USER="${NYANQL_USER:-nyanql}"
NYANQL_PASSWORD="${NYANQL_PASSWORD:-change-me}"
NYAN8_BASE_URL="${NYAN8_BASE_URL:-http://localhost:8889}"

json_get() {
  local url="$1"
  curl -fsS "$url"
}

json_get_auth() {
  local url="$1"
  curl -fsS -u "$NYANQL_USER:$NYANQL_PASSWORD" "$url"
}

json_check() {
  local expression="$1"
  if command -v jq >/dev/null 2>&1; then
    jq -e "$expression" >/dev/null
  else
    node -e 'let input = ""; process.stdin.on("data", d => input += d); process.stdin.on("end", () => { const data = JSON.parse(input); const root = data.result || data; if (!root.categories?.[0]?.items?.length && !Array.isArray(root)) process.exit(1); if (Array.isArray(root) && root.length === 0) process.exit(1); });'
  fi
}

echo "1 psql list_menu.sql"
psql "$DATABASE_URL" -f "$ROOT_DIR/backend/nyanql/sql/list_menu.sql" >/tmp/cafe-order-menu-psql.out
if ! grep -Eq "\([1-9][0-9]* rows?\)" /tmp/cafe-order-menu-psql.out; then
  cat /tmp/cafe-order-menu-psql.out
  echo "list_menu.sql returned no rows" >&2
  exit 1
fi
cat /tmp/cafe-order-menu-psql.out

echo "2 NyanQL /menu"
nyanql_response="$(json_get_auth "$NYANQL_BASE_URL/menu")"
printf '%s\n' "$nyanql_response"
printf '%s' "$nyanql_response" | json_check '.result | length > 0'

echo "3 Nyan8 /api/customer/menu"
nyan8_response="$(json_get "$NYAN8_BASE_URL/api/customer/menu?terminal_code=customer-T01")"
printf '%s\n' "$nyan8_response"
printf '%s' "$nyan8_response" | json_check '(.result // .).categories | length > 0'
printf '%s' "$nyan8_response" | json_check '(.result // .).categories[0].items | length > 0'

echo "smoke-menu completed"
