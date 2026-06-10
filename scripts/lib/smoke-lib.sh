#!/usr/bin/env bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_URL="${NYAN8_BASE_URL:-http://localhost:8889}"
DATABASE_URL="${DATABASE_URL:-postgres://codex:codex@localhost:5432/cafe_order_system}"
TODAY="$(date +%F)"
LAST_BODY=""
LAST_STATUS=""
LAST_HEADERS=""
LAST_STEP=""
SMOKE_NAME="${SMOKE_NAME:-smoke}"

pass() {
  echo
  echo "PASS: $SMOKE_NAME"
}

fail() {
  echo
  echo "FAIL: $SMOKE_NAME" >&2
  echo "ERROR: $*" >&2
  if [ -n "$LAST_STEP" ]; then echo "STEP: $LAST_STEP" >&2; fi
  if [ -n "$LAST_STATUS" ]; then echo "HTTP_STATUS: $LAST_STATUS" >&2; fi
  if [ -n "$LAST_HEADERS" ]; then
    echo "LAST_HEADERS:" >&2
    printf '%s\n' "$LAST_HEADERS" >&2
  fi
  if [ -n "$LAST_BODY" ]; then
    echo "LAST_RESPONSE:" >&2
    printf '%s\n' "$LAST_BODY" >&2
  fi
  exit 1
}

step() {
  LAST_STEP="$1"
  printf '\n== %s ==\n' "$LAST_STEP" >&2
}

reset_db() {
  step "DB を初期化"
  "$ROOT_DIR/scripts/dev-reset-db.sh"
}

json_eval() {
  local script="$1"
  node -e '
const script = process.argv[1];
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  try {
    const data = input ? JSON.parse(input) : null;
    const root = data && Object.prototype.hasOwnProperty.call(data, "result") ? data.result : data;
    const value = Function("data", "root", script)(data, root);
    if (value === undefined || value === null || value === false) process.exit(2);
    if (typeof value === "object") console.log(JSON.stringify(value));
    else console.log(String(value));
  } catch (event) {
    console.error(event && event.message ? event.message : String(event));
    process.exit(1);
  }
});' "$script"
}

assert_json() {
  local script="$1"
  local reason="$2"
  if ! printf '%s' "$LAST_BODY" | json_eval "$script" >/dev/null; then
    fail "$reason"
  fi
}

extract_json() {
  local script="$1"
  local reason="$2"
  local value
  if ! value="$(printf '%s' "$LAST_BODY" | json_eval "$script")"; then
    fail "$reason"
  fi
  if [ -z "$value" ]; then fail "$reason"; fi
  printf '%s' "$value"
}

call_api() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local expected="${4:-ok}"
  local tmp
  tmp="$(mktemp)"

  echo "$method /$path" >&2
  if [ "$method" = "GET" ]; then
    LAST_STATUS="$(curl -sS -o "$tmp" -w '%{http_code}' "$BASE_URL/$path" || true)"
  else
    LAST_STATUS="$(curl -sS -o "$tmp" -w '%{http_code}' -H 'Content-Type: application/json' -d "$body" "$BASE_URL/$path" || true)"
  fi
  LAST_BODY="$(cat "$tmp")"
  LAST_HEADERS=""
  rm -f "$tmp"
  echo "HTTP_STATUS=$LAST_STATUS" >&2
  printf '%s\n' "$LAST_BODY" >&2

  case "$expected" in
    ok)
      case "$LAST_STATUS" in 2*) ;; *) fail "unexpected HTTP status for /$path";; esac
      assert_json 'return data && data.success === true' "API /$path did not return success=true"
      ;;
    rejected)
      assert_json 'return data && data.success === false && Number(data.status) >= 400' "API /$path was not rejected with success=false and status>=400"
      ;;
    raw)
      case "$LAST_STATUS" in 2*) ;; *) fail "unexpected HTTP status for /$path";; esac
      ;;
    *)
      [ "$LAST_STATUS" = "$expected" ] || fail "unexpected HTTP status for /$path"
      ;;
  esac
}

call_get() {
  call_api GET "$1" "" "${2:-ok}"
}

call_post() {
  call_api POST "$1" "$2" "${3:-ok}"
}

call_raw_get() {
  local path="$1"
  local tmp_body
  local tmp_headers
  tmp_body="$(mktemp)"
  tmp_headers="$(mktemp)"
  echo "GET /$path" >&2
  LAST_STATUS="$(curl -sS -D "$tmp_headers" -o "$tmp_body" -w '%{http_code}' "$BASE_URL/$path" || true)"
  LAST_BODY="$(cat "$tmp_body")"
  LAST_HEADERS="$(cat "$tmp_headers")"
  rm -f "$tmp_body" "$tmp_headers"
  echo "HTTP_STATUS=$LAST_STATUS" >&2
  printf '%s\n' "$LAST_HEADERS" >&2
  printf '%s\n' "$LAST_BODY" >&2
  case "$LAST_STATUS" in 2*) ;; *) fail "unexpected HTTP status for /$path";; esac
}

sql_scalar() {
  local query="$1"
  psql "$DATABASE_URL" -At -c "$query"
}

assert_sql() {
  local query="$1"
  local expected="$2"
  local reason="$3"
  local actual
  actual="$(sql_scalar "$query" | tail -n 1)"
  echo "SQL_RESULT=$actual" >&2
  [ "$actual" = "$expected" ] || fail "$reason (expected=$expected actual=$actual)"
}

assert_sql_number_ge() {
  local query="$1"
  local min="$2"
  local reason="$3"
  local actual
  actual="$(sql_scalar "$query" | tail -n 1)"
  echo "SQL_RESULT=$actual" >&2
  if ! node -e 'const actual=Number(process.argv[1]); const min=Number(process.argv[2]); process.exit(Number.isFinite(actual) && actual >= min ? 0 : 1);' "$actual" "$min"; then
    fail "$reason (min=$min actual=$actual)"
  fi
}

open_session() {
  local terminal="$1"
  local table="$2"
  call_post "api/customer/session/open" "{\"terminal_code\":\"$terminal\",\"table_code\":\"$table\",\"guest_count\":1}"
  extract_json 'return root.session && root.session.id' "session_id が取得できません"
}

submit_order() {
  local terminal="$1"
  local table="$2"
  local items_json="$3"
  call_post "api/customer/order/submit" "{\"terminal_code\":\"$terminal\",\"table_code\":\"$table\",\"items\":$items_json}"
  extract_json 'return root.orderNo' "order_no が取得できません"
}

first_ticket_id() {
  local table="$1"
  local status="${2:-ordered}"
  extract_json "const ticket = (root.tickets || []).find(row => row.table_code === '$table' && row.status === '$status'); return ticket && ticket.order_item_id" "$table の $status order_item_id が取得できません"
}

transition_item() {
  local item_id="$1"
  local status="$2"
  call_post "api/kitchen/item/status" "{\"terminal_code\":\"kitchen-main\",\"order_item_id\":\"$item_id\",\"status\":\"$status\"}"
  assert_json "return root.item && root.item.status === '$status'" "order_item $item_id が $status になっていません"
}

make_item_ready() {
  local item_id="$1"
  transition_item "$item_id" accepted
  transition_item "$item_id" cooking
  transition_item "$item_id" ready
}

complete_task() {
  local task_id="$1"
  call_post "api/hall/task/status" "{\"terminal_code\":\"hall-main\",\"task_id\":\"$task_id\",\"status\":\"doing\"}"
  assert_json 'return root.task && root.task.status === "doing"' "task が doing になっていません"
  call_post "api/hall/task/status" "{\"terminal_code\":\"hall-main\",\"task_id\":\"$task_id\",\"status\":\"done\"}"
  assert_json 'return root.task && root.task.status === "done"' "task が done になっていません"
}

complete_serve_task_for_item() {
  local item_id="$1"
  call_get "api/hall/tasks?terminal_code=hall-main"
  local task_id
  task_id="$(extract_json "const task = (root.tasks || []).find(row => row.task_type === 'serve_item' && row.order_item_id === '$item_id'); return task && task.id" "$item_id の配膳 task_id が取得できません")"
  echo "serve_task_id=$task_id"
  complete_task "$task_id"
}

request_payment() {
  local table="$1"
  call_post "api/customer/payment/request" "{\"terminal_code\":\"customer-$table\",\"table_code\":\"$table\"}"
  assert_json 'return root.session && root.session.status === "payment_requested"' "$table が payment_requested になっていません"
}

settle_table() {
  local table="$1"
  local method="${2:-card}"
  call_post "api/checkout/settle" "{\"terminal_code\":\"checkout-main\",\"table_code\":\"$table\",\"method\":\"$method\"}"
  extract_json 'return root.payment && root.payment.id' "payment_id が取得できません"
}

complete_clean_task_for_table() {
  local table="$1"
  call_get "api/hall/tasks?terminal_code=hall-main"
  local task_id
  task_id="$(extract_json "const task = (root.tasks || []).find(row => row.task_type === 'clean_table' && row.table_code === '$table'); return task && task.id" "$table の片付け task_id が取得できません")"
  echo "clean_task_id=$task_id"
  complete_task "$task_id"
}
