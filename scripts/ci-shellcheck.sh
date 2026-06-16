#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FAILED=0

SHELL_FILES=()
while IFS= read -r -d '' file; do
  SHELL_FILES+=("$file")
done < <(
  find "$ROOT_DIR/scripts" "$ROOT_DIR/deploy" \
    -type f -name '*.sh' -print0 2>/dev/null | sort -z
)

if [ "${#SHELL_FILES[@]}" -eq 0 ]; then
  echo "NG: no shell scripts found" >&2
  exit 1
fi

for file in "${SHELL_FILES[@]}"; do
  relative="${file#$ROOT_DIR/}"
  if bash -n "$file"; then
    echo "OK: bash -n $relative"
  else
    echo "NG: bash -n failed: $relative" >&2
    FAILED=1
  fi
done

if command -v shellcheck >/dev/null 2>&1; then
  for file in "${SHELL_FILES[@]}"; do
    relative="${file#$ROOT_DIR/}"
    if shellcheck "$file"; then
      echo "OK: shellcheck $relative"
    else
      echo "NG: shellcheck failed: $relative" >&2
      FAILED=1
    fi
  done
else
  echo "SKIP: shellcheck is not installed"
fi

if [ "$FAILED" -eq 0 ]; then
  echo
  echo "PASS: shell script syntax check"
else
  echo
  echo "FAIL: shell script syntax check" >&2
fi

exit "$FAILED"
