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

require_file() {
  local path="$1"
  if [ -f "$ROOT_DIR/$path" ]; then
    ok "$path exists"
  else
    ng "$path is missing"
  fi
}

require_dir() {
  local path="$1"
  if [ -d "$ROOT_DIR/$path" ]; then
    ok "$path exists"
  else
    ng "$path is missing"
  fi
}

require_grep() {
  local pattern="$1"
  local path="$2"
  local ok_message="$3"
  local ng_message="$4"
  if grep -q "$pattern" "$ROOT_DIR/$path"; then
    ok "$ok_message"
  else
    ng "$ng_message"
  fi
}

require_file "frontend/dist/index.html"
require_dir "frontend/dist/assets"
require_file "deploy/nginx/cafe-order-system.conf.example"
require_file ".env.production.example"
require_file "docs/08_operations.md"
require_file "docs/06_acceptance_criteria.md"
require_file "docs/07_development_plan.md"
require_file "README.md"

for key in DATABASE_URL NYANQL_HOST NYANQL_PORT NYAN8_HOST NYAN8_PORT APP_BASE_URL SESSION_COOKIE_NAME SESSION_TTL_SECONDS COOKIE_SECURE COOKIE_SAMESITE LOG_DIR NYANQL_BASIC_AUTH_USER NYANQL_BASIC_AUTH_PASSWORD NYANQL_BASE_URL; do
  if grep -Eq "^${key}=.+" "$ROOT_DIR/.env.production.example"; then
    ok "$key is present in .env.production.example"
  else
    ng "$key is missing in .env.production.example"
  fi
done

require_grep "本番相当デプロイ準備" "README.md" "README has production deployment section" "README production deployment section missing"
require_grep "GitHub Actions CI" "README.md" "README has CI section" "README CI section missing"
require_grep "Phase 9 本番デプロイ準備" "docs/06_acceptance_criteria.md" "acceptance criteria has Phase 9" "Phase 9 acceptance criteria missing"
require_grep "Phase 10 CI / 自動テスト" "docs/06_acceptance_criteria.md" "acceptance criteria has Phase 10" "Phase 10 acceptance criteria missing"
require_grep "Phase 9: 本番デプロイ準備" "docs/07_development_plan.md" "development plan has Phase 9" "Phase 9 missing in development plan"
require_grep "Phase 10: CI / 自動テスト" "docs/07_development_plan.md" "development plan has Phase 10" "Phase 10 missing in development plan"
require_grep "現在フェーズ" "docs/07_development_plan.md" "development plan marks current phase" "current phase marker missing"
require_grep "CI lightweight checks" "docs/08_operations.md" "operations doc has CI lightweight checks" "operations CI lightweight checks missing"

if [ "$FAILED" -eq 0 ]; then
  echo
  echo "PASS: production readiness static check"
else
  echo
  echo "FAIL: production readiness static check" >&2
fi

exit "$FAILED"
