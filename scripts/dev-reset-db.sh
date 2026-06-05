#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATABASE_URL="${DATABASE_URL:-postgres://codex:codex@localhost:5432/cafe_order_system}"

psql "$DATABASE_URL" -f "$ROOT_DIR/backend/nyanql/sql/schema.sql"
psql "$DATABASE_URL" -f "$ROOT_DIR/backend/nyanql/sql/seed.sql"
echo "dev DB reset completed: $DATABASE_URL"
