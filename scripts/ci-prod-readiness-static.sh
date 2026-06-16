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
  [ -f "$ROOT_DIR/$path" ] && ok "$path exists" || ng "$path is missing"
}

require_dir() {
  local path="$1"
  [ -d "$ROOT_DIR/$path" ] && ok "$path exists" || ng "$path is missing"
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

grep -q "本番相当デプロイ準備" "$ROOT_DIR/README.md" && ok "README has production deployment section" || ng "README production deployment section missing"
grep -q "GitHub Actions CI" "$ROOT_DIR/README.md" && ok "README has CI section" || ng "README CI section missing"
grep -q "Phase 9 本番デプロイ準備" "$ROOT_DIR/docs/06_acceptance_criteria.md" && ok "acceptance criteria has Phase 9" || ng "Phase 9 acceptance criteria missing"
grep -q "Phase 10 CI / 自動テスト" "$ROOT_DIR/docs/06_acceptance_criteria.md" && ok "acceptance criteria has Phase 10" || ng "Phase 10 acceptance criteria missing"
grep -q "Phase 9: 本番デプロイ準備" "$ROOT_DIR/docs/07_development_plan.md" && ok "development plan has Phase 9" || ng "Phase 9 missing in development plan"
grep -q "Phase 10: CI / 自動テスト" "$ROOT_DIR/docs/07_development_plan.md" && ok "development plan has Phase 10" || ng "Phase 10 missing in development plan"
grep -q "現在フェーズ" "$ROOT_DIR/docs/07_development_plan.md" && ok "development plan marks current phase" || ng "current phase marker missing"
grep -q "CI lightweight checks" "$ROOT_DIR/docs/08_operations.md" && ok "operations doc has CI lightweight checks" || ng "operations CI lightweight checks missing"

if [ "$FAILED" -eq 0 ]; then
  echo
  echo "PASS: production readiness static check"
else
  echo
  echo "FAIL: production readiness static check" >&2
fi

exit "$FAILED"
