#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${NYAN8_BASE_URL:-http://localhost:8889}"
DATABASE_URL="${DATABASE_URL:-postgres://codex:codex@localhost:5432/cafe_order_system}"
TODAY="$(date +%F)"
LAST_BODY=""
LAST_STATUS=""
LAST_STEP=""
COOKIE_JAR="$(mktemp)"
AUTH_TOKEN=""
trap 'rm -f "$COOKIE_JAR"' EXIT

log_step() {
  LAST_STEP="$1"
  printf '\n== %s ==\n' "$LAST_STEP"
}

fail() {
  echo "ERROR: $*" >&2
  if [ -n "$LAST_STEP" ]; then echo "STEP: $LAST_STEP" >&2; fi
  if [ -n "$LAST_STATUS" ]; then echo "HTTP_STATUS: $LAST_STATUS" >&2; fi
  if [ -n "$LAST_BODY" ]; then
    echo "LAST_RESPONSE:" >&2
    printf '%s\n' "$LAST_BODY" >&2
  fi
  exit 1
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

sync_cookie_from_body() {
  local cookie_line
  cookie_line="$(printf '%s' "$LAST_BODY" | node -e '
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  try {
    const data = input ? JSON.parse(input) : null;
    const header = data && data.headers && data.headers["Set-Cookie"];
    if (header) process.stdout.write(header);
  } catch {}
});' || true)"
  if [ -z "$cookie_line" ]; then return 0; fi
  if printf '%s' "$cookie_line" | grep -q 'Max-Age=0'; then
    : > "$COOKIE_JAR"
    return 0
  fi
  local cookie_pair cookie_name cookie_value expires_at
  cookie_pair="${cookie_line%%;*}"
  cookie_name="${cookie_pair%%=*}"
  cookie_value="${cookie_pair#*=}"
  expires_at="$(date -v+8H +%s 2>/dev/null || date -d '+8 hours' +%s)"
  {
    printf '# Netscape HTTP Cookie File\n'
    printf 'localhost\tFALSE\t/\tFALSE\t%s\t%s\t%s\n' "$expires_at" "$cookie_name" "$cookie_value"
  } > "$COOKIE_JAR"
}

extract_token_from_body() {
  printf '%s' "$LAST_BODY" | node -e '
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  const data = JSON.parse(input.trim());
  const header = data && data.headers && data.headers["Set-Cookie"] || "";
  const match = header.match(/cafe_session=([^;]+)/);
  if (match) process.stdout.write(decodeURIComponent(match[1]));
});'
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
  local expected="${4:-2xx}"
  local tmp
  local request_path="$path"
  local request_body="$body"
  local curl_headers=()
  tmp="$(mktemp)"

  if [ -n "$AUTH_TOKEN" ] && [[ "$request_path" != api/customer/* ]]; then
    curl_headers=(-H "Authorization: Bearer $AUTH_TOKEN")
    if [ "$method" = "GET" ]; then
      case "$request_path" in
        *\?*) request_path="$request_path&token=$AUTH_TOKEN" ;;
        *) request_path="$request_path?token=$AUTH_TOKEN" ;;
      esac
    elif [ -n "$request_body" ]; then
      request_body="$(printf '%s' "$request_body" | node -e 'let input=""; process.stdin.on("data", c => input += c); process.stdin.on("end", () => { const data = input ? JSON.parse(input) : {}; data.token = process.argv[1]; console.log(JSON.stringify(data)); });' "$AUTH_TOKEN")"
    fi
  fi

  echo "$method /$request_path"
  if [ "$method" = "GET" ]; then
    LAST_STATUS="$(curl -sS -b "$COOKIE_JAR" -c "$COOKIE_JAR" -o "$tmp" -w '%{http_code}' ${curl_headers[@]+"${curl_headers[@]}"} "$BASE_URL/$request_path" || true)"
  else
    LAST_STATUS="$(curl -sS -b "$COOKIE_JAR" -c "$COOKIE_JAR" -o "$tmp" -w '%{http_code}' ${curl_headers[@]+"${curl_headers[@]}"} -H 'Content-Type: application/json' -d "$request_body" "$BASE_URL/$request_path" || true)"
  fi
  LAST_BODY="$(cat "$tmp")"
  rm -f "$tmp"
  sync_cookie_from_body
  printf '%s\n' "$LAST_BODY"

  case "$expected" in
    2xx)
      case "$LAST_STATUS" in 2*) ;; *) fail "unexpected HTTP status for /$path";; esac
      assert_json 'return data && data.success === true' "API /$path did not return success=true"
      ;;
    rejected)
      assert_json 'return data && data.success === false' "API /$path was not rejected with success=false"
      ;;
    *)
      [ "$LAST_STATUS" = "$expected" ] || fail "unexpected HTTP status for /$path"
      ;;
  esac
}

login_as() {
  local login_id="$1"
  local password="$2"
  local terminal_code="$3"
  : > "$COOKIE_JAR"
  call_post "api/auth/login" "{\"loginId\":\"$login_id\",\"password\":\"$password\",\"terminalCode\":\"$terminal_code\"}"
  assert_json 'return root.user && !root.token' "$login_id login response が不正です"
  AUTH_TOKEN="$(extract_token_from_body)"
  if [ -z "$AUTH_TOKEN" ]; then fail "$login_id session token を疑似 cookie から抽出できません"; fi
}

call_get() {
  call_api GET "$1" "" "${2:-2xx}"
}

call_post() {
  call_api POST "$1" "$2" "${3:-2xx}"
}

"$(cd "$(dirname "$0")" && pwd)/dev-reset-db.sh"

log_step "1. 顧客端末 customer-T01 でセッション開始"
call_post "api/customer/session/open" '{"terminal_code":"customer-T01","table_code":"T01","guest_count":1}'
session_id="$(extract_json 'return root.session && root.session.id' "session_id が取得できません")"
echo "session_id=$session_id"
assert_json 'return root.session && root.session.status === "seated"' "セッション開始後の status が seated ではありません"

log_step "2. メニュー取得"
call_get "api/customer/menu?terminal_code=customer-T01"
assert_json 'return root.categories && root.categories.length > 0' "メニューカテゴリが取得できません"
assert_json 'return root.categories.some(category => category.items && category.items.length > 0)' "メニュー商品が取得できません"

log_step "3. 注文確定"
call_post "api/customer/order/submit" '{"terminal_code":"customer-T01","table_code":"T01","items":[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""}]}'
order_no="$(extract_json 'return root.orderNo' "order_no が取得できません")"
echo "order_no=$order_no"

log_step "4. キッチンチケット取得"
login_as manager manager123 analytics-manager
call_get "api/kitchen/tickets?terminal_code=kitchen-main"
order_item_id="$(extract_json 'const ticket = (root.tickets || []).find(row => row.status === "ordered"); return ticket && ticket.order_item_id' "ordered の order_item_id が取得できません")"
echo "order_item_id=$order_item_id"

log_step "5. 不正な注文明細遷移 ordered -> ready を拒否"
call_post "api/kitchen/item/status" "{\"terminal_code\":\"kitchen-main\",\"order_item_id\":\"$order_item_id\",\"status\":\"ready\"}" "rejected"

log_step "6. 注文明細を accepted -> cooking -> ready に進める"
call_post "api/kitchen/item/status" "{\"terminal_code\":\"kitchen-main\",\"order_item_id\":\"$order_item_id\",\"status\":\"accepted\"}"
assert_json 'return root.item && root.item.status === "accepted"' "order_item が accepted になっていません"
call_post "api/kitchen/item/status" "{\"terminal_code\":\"kitchen-main\",\"order_item_id\":\"$order_item_id\",\"status\":\"cooking\"}"
assert_json 'return root.item && root.item.status === "cooking"' "order_item が cooking になっていません"
call_post "api/kitchen/item/status" "{\"terminal_code\":\"kitchen-main\",\"order_item_id\":\"$order_item_id\",\"status\":\"ready\"}"
assert_json 'return root.item && root.item.status === "ready"' "order_item が ready になっていません"
serve_task_from_ready="$(extract_json 'return root.task && root.task.id' "ready 時に配膳タスク ID が作成されていません")"
echo "serve_task_id_from_ready=$serve_task_from_ready"

log_step "7. 不正な注文明細逆戻り ready -> accepted を拒否"
call_post "api/kitchen/item/status" "{\"terminal_code\":\"kitchen-main\",\"order_item_id\":\"$order_item_id\",\"status\":\"accepted\"}" "rejected"

log_step "8. 存在しない order_item_id の状態変更を拒否"
call_post "api/kitchen/item/status" '{"terminal_code":"kitchen-main","order_item_id":"oi-not-found","status":"accepted"}' "rejected"

log_step "9. ホール配膳タスク取得"
call_get "api/hall/tasks?terminal_code=hall-main"
serve_task_id="$(extract_json 'const task = (root.tasks || []).find(row => row.task_type === "serve_item" && row.status === "todo"); return task && task.id' "todo の serve_task_id が取得できません")"
echo "serve_task_id=$serve_task_id"

log_step "10. 配膳タスクを doing -> done に進める"
call_post "api/hall/task/status" "{\"terminal_code\":\"hall-main\",\"task_id\":\"$serve_task_id\",\"status\":\"doing\"}"
assert_json 'return root.task && root.task.status === "doing"' "配膳タスクが doing になっていません"
call_post "api/hall/task/status" "{\"terminal_code\":\"hall-main\",\"task_id\":\"$serve_task_id\",\"status\":\"done\"}"
assert_json 'return root.task && root.task.status === "done"' "配膳タスクが done になっていません"

log_step "11. 完了済みホールタスクの再完了を拒否"
call_post "api/hall/task/status" "{\"terminal_code\":\"hall-main\",\"task_id\":\"$serve_task_id\",\"status\":\"done\"}" "rejected"

log_step "12. 存在しない task_id の状態変更を拒否"
call_post "api/hall/task/status" '{"terminal_code":"hall-main","task_id":"task-not-found","status":"doing"}' "rejected"

log_step "13. 会計依頼"
call_post "api/customer/payment/request" '{"terminal_code":"customer-T01","table_code":"T01"}'
assert_json 'return root.session && root.session.status === "payment_requested"' "セッションが payment_requested になっていません"

log_step "14. 会計依頼後の追加注文を拒否"
call_post "api/customer/order/submit" '{"terminal_code":"customer-T01","table_code":"T01","items":[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""}]}' "rejected"

log_step "15. レジ精算"
call_post "api/checkout/settle" '{"terminal_code":"checkout-main","table_code":"T01","method":"card"}'
payment_id="$(extract_json 'return root.payment && root.payment.id' "payment_id が取得できません")"
echo "payment_id=$payment_id"
assert_json 'return root.payment && root.payment.total_amount > 0' "精算金額が 0 です"

log_step "16. 精算済みセッションの再精算を拒否"
call_post "api/checkout/settle" '{"terminal_code":"checkout-main","table_code":"T01","method":"card"}' "rejected"

log_step "17. 片付けタスク取得"
call_get "api/hall/tasks?terminal_code=hall-main"
clean_task_id="$(extract_json 'const task = (root.tasks || []).find(row => row.task_type === "clean_table" && row.status === "todo"); return task && task.id' "todo の clean_task_id が取得できません")"
echo "clean_task_id=$clean_task_id"

log_step "18. 片付けタスクを doing -> done に進める"
call_post "api/hall/task/status" "{\"terminal_code\":\"hall-main\",\"task_id\":\"$clean_task_id\",\"status\":\"doing\"}"
assert_json 'return root.task && root.task.status === "doing"' "片付けタスクが doing になっていません"
call_post "api/hall/task/status" "{\"terminal_code\":\"hall-main\",\"task_id\":\"$clean_task_id\",\"status\":\"done\"}"
assert_json 'return root.task && root.task.status === "done"' "片付けタスクが done になっていません"

log_step "19. 席を空席へ戻す"
call_post "api/customer/session/open" '{"terminal_code":"customer-T01","table_code":"T01","guest_count":1}'
new_session_id="$(extract_json 'return root.session && root.session.id' "片付け後に新規セッションを開始できません")"
echo "new_session_id=$new_session_id"
if [ "$new_session_id" = "$session_id" ]; then
  fail "片付け完了後も同じ session_id が返っています"
fi

log_step "20. 端末種別の不正操作を拒否"
call_post "api/customer/order/submit" '{"terminal_code":"hall-main","table_code":"T01","items":[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""}]}' "rejected"
call_get "api/kitchen/tickets?terminal_code=customer-T01" "rejected"
call_get "api/hall/tasks?terminal_code=kitchen-main" "rejected"
call_post "api/checkout/settle" '{"terminal_code":"hall-main","table_code":"T01","method":"card"}' "rejected"

log_step "21. 売切商品の注文を拒否"
call_post "api/customer/order/submit" '{"terminal_code":"customer-T01","table_code":"T01","items":[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""}]}'
psql "${DATABASE_URL:-postgres://codex:codex@localhost:5432/cafe_order_system}" -c "UPDATE menu_items SET sold_out = TRUE WHERE id = 'item-blend'" >/dev/null
call_post "api/customer/order/submit" '{"terminal_code":"customer-T01","table_code":"T01","items":[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""}]}' "rejected"
psql "${DATABASE_URL:-postgres://codex:codex@localhost:5432/cafe_order_system}" -c "UPDATE menu_items SET sold_out = FALSE WHERE id = 'item-blend'" >/dev/null

log_step "22. 分析サマリ確認"
call_get "api/analytics/summary?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY"
assert_json 'return root.summary && root.summary.sales_total > 0' "分析サマリに売上が反映されていません"
assert_json 'return root.summary && root.summary.cost_total > 0 && root.summary.gross_profit > 0 && root.summary.gross_margin_rate > 0' "分析サマリに原価・粗利が反映されていません"
assert_json 'return root.summary && root.summary.payment_count > 0' "分析サマリに会計件数が反映されていません"
echo "sales_total=$(extract_json 'return root.summary.sales_total' "sales_total が取得できません")"
echo "gross_profit=$(extract_json 'return root.summary.gross_profit' "gross_profit が取得できません")"
echo "payment_count=$(extract_json 'return root.summary.payment_count' "payment_count が取得できません")"

log_step "23. 商品ランキング確認"
call_get "api/analytics/item-ranking?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY"
assert_json 'return root.items && root.items.length > 0' "商品ランキングが反映されていません"
assert_json 'return root.items.some(item => item.cost_total > 0 && item.gross_profit > 0 && item.gross_margin_rate > 0)' "商品ランキングに原価・粗利が反映されていません"

echo
echo "smoke-e2e completed"
