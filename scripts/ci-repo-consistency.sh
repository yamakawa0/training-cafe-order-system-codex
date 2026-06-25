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

required_files=(
  "README.md"
  ".env.example"
  ".env.production.example"
  "deploy/nginx/cafe-order-system.conf.example"
  "docs/06_acceptance_criteria.md"
  "docs/07_development_plan.md"
  "docs/08_operations.md"
  "docs/assumptions.md"
  "docs/development-notes.md"
  "frontend/package.json"
  "frontend/package-lock.json"
  "frontend/vite.config.ts"
  "backend/nyan8/api.json"
  "backend/nyanql/api.json"
  "backend/nyanql/sql/schema.sql"
  "backend/nyanql/sql/seed.sql"
  ".github/workflows/ci.yml"
)

for path in "${required_files[@]}"; do
  require_file "$path"
done

require_dir "backend/nyan8/javascript/apis"
require_dir "backend/nyan8/javascript/lib"
require_dir "backend/nyanql/sql"
require_dir "scripts"

for script in \
  "scripts/ci-shellcheck.sh" \
  "scripts/ci-repo-consistency.sh" \
  "scripts/ci-prod-readiness-static.sh" \
  "scripts/smoke-prod-readiness.sh" \
  "scripts/dev-reset-db.sh" \
  "scripts/smoke-auth.sh" \
  "scripts/smoke-audit-logs.sh" \
  "scripts/smoke-admin-orders.sh" \
  "scripts/smoke-admin-menu.sh" \
  "scripts/smoke-inventory.sh" \
  "scripts/smoke-admin-tables.sh" \
  "scripts/smoke-menu.sh" \
  "scripts/smoke-e2e.sh" \
  "scripts/smoke-order-multiple-items.sh" \
  "scripts/smoke-multiple-tables.sh" \
  "scripts/smoke-cancel-flow.sh" \
  "scripts/smoke-staff-call.sh" \
  "scripts/smoke-refund-receipt.sh" \
  "scripts/smoke-payment-failure-cancel.sh" \
  "scripts/smoke-payment-provider.sh" \
  "scripts/smoke-daily-close.sh" \
  "scripts/smoke-checkout-csv.sh" \
  "scripts/smoke-invalid-operations.sh"
do
  require_file "$script"
done

if git -C "$ROOT_DIR" ls-files --error-unmatch .env.production >/dev/null 2>&1; then
  ng ".env.production is tracked by git"
else
  ok ".env.production is not tracked by git"
fi

if node "$ROOT_DIR/scripts/check-nyan8-api-files.mjs"; then
  ok "Nyan8 api.json references existing JavaScript files"
else
  ng "Nyan8 api.json consistency check failed"
fi

if node "$ROOT_DIR/scripts/check-nyanql-sql-files.mjs"; then
  ok "NyanQL api.json references existing SQL files"
else
  ng "NyanQL api.json consistency check failed"
fi

require_grep "GitHub Actions CI" "README.md" "README has CI section" "README CI section missing"
require_grep "CI / 自動テスト" "docs/07_development_plan.md" "development plan has Phase 10" "Phase 10 missing in development plan"
require_grep "Phase 10 CI / 自動テスト" "docs/06_acceptance_criteria.md" "acceptance criteria has Phase 10" "Phase 10 acceptance criteria missing"
require_grep "CI lightweight checks" "docs/08_operations.md" "operations doc separates CI and full smoke" "CI/full smoke separation missing in operations doc"

if [ "$FAILED" -eq 0 ]; then
  echo
  echo "PASS: repository consistency check"
else
  echo
  echo "FAIL: repository consistency check" >&2
fi

exit "$FAILED"
