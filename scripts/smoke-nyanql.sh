#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${NYANQL_BASE_URL:-http://localhost:8890}"
AUTH_USER="${NYANQL_USER:-nyanql}"
AUTH_PASS="${NYANQL_PASSWORD:-change-me}"

call_get() {
  local path="$1"
  echo "GET $path"
  curl -fsS -u "$AUTH_USER:$AUTH_PASS" "$BASE_URL/$path"
  echo
}

call_get "bootstrap?terminal_code=customer-T01"
call_get "menu"
call_get "sessions/current?table_code=T01"
call_get "checkout/summary?table_code=T01"
call_get "analytics/summary?from_date=2026-06-05&to_date=2026-06-05"
echo "smoke-nyanql completed"
