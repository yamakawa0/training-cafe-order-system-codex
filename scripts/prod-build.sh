#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT_DIR/frontend"
npm install
npm audit --audit-level=high
npm run build

test -f "$ROOT_DIR/frontend/dist/index.html"
test -d "$ROOT_DIR/frontend/dist/assets"

echo "production frontend build is ready: $ROOT_DIR/frontend/dist"
