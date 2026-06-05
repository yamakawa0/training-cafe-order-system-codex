#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${NYAN8_BASE_URL:-http://localhost:8889}"

api_get() {
  local path="$1"
  curl -fsS "$BASE_URL/$path"
}

api_post() {
  local path="$1"
  local body="$2"
  curl -fsS -H 'Content-Type: application/json' -d "$body" "$BASE_URL/$path"
}

extract_first_id() {
  node -e 'let text="";process.stdin.on("data",d=>text+=d);process.stdin.on("end",()=>{const data=JSON.parse(text);const root=data.result||data;const key=process.argv[1];const rows=root[key]||root.tickets||root.tasks||[];const row=rows[0]||{};console.log(key==="tasks" ? (row.id||"") : (row.order_item_id||row.id||""));});' "$1"
}

echo "1 session open"
api_post "api/customer/session/open" '{"terminal_code":"customer-T01","table_code":"T01","guest_count":1}'
echo

echo "2 menu"
api_get "api/customer/menu?terminal_code=customer-T01"
echo

echo "3 submit order"
api_post "api/customer/order/submit" '{"terminal_code":"customer-T01","table_code":"T01","items":[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""}]}'
echo

echo "4 kitchen tickets"
tickets="$(api_get "api/kitchen/tickets?terminal_code=kitchen-main")"
echo "$tickets"
order_item_id="$(printf '%s' "$tickets" | extract_first_id tickets)"
test -n "$order_item_id"

echo "5 kitchen transitions: $order_item_id"
api_post "api/kitchen/item/status" "{\"terminal_code\":\"kitchen-main\",\"order_item_id\":\"$order_item_id\",\"status\":\"accepted\"}"
api_post "api/kitchen/item/status" "{\"terminal_code\":\"kitchen-main\",\"order_item_id\":\"$order_item_id\",\"status\":\"cooking\"}"
api_post "api/kitchen/item/status" "{\"terminal_code\":\"kitchen-main\",\"order_item_id\":\"$order_item_id\",\"status\":\"ready\"}"
echo

echo "6 hall serve task"
tasks="$(api_get "api/hall/tasks?terminal_code=hall-main")"
echo "$tasks"
serve_task_id="$(printf '%s' "$tasks" | extract_first_id tasks)"
test -n "$serve_task_id"

echo "7 serve task transitions: $serve_task_id"
api_post "api/hall/task/status" "{\"terminal_code\":\"hall-main\",\"task_id\":\"$serve_task_id\",\"status\":\"doing\"}"
api_post "api/hall/task/status" "{\"terminal_code\":\"hall-main\",\"task_id\":\"$serve_task_id\",\"status\":\"done\"}"
echo

echo "8 payment request"
api_post "api/customer/payment/request" '{"terminal_code":"customer-T01","table_code":"T01"}'
echo

echo "9 checkout settle"
api_post "api/checkout/settle" '{"terminal_code":"checkout-main","table_code":"T01","method":"card"}'
echo

echo "10 clean task"
tasks="$(api_get "api/hall/tasks?terminal_code=hall-main")"
echo "$tasks"
clean_task_id="$(printf '%s' "$tasks" | extract_first_id tasks)"
test -n "$clean_task_id"

echo "11 clean task transitions: $clean_task_id"
api_post "api/hall/task/status" "{\"terminal_code\":\"hall-main\",\"task_id\":\"$clean_task_id\",\"status\":\"doing\"}"
api_post "api/hall/task/status" "{\"terminal_code\":\"hall-main\",\"task_id\":\"$clean_task_id\",\"status\":\"done\"}"
echo

echo "12 analytics"
api_get "api/analytics/summary?terminal_code=analytics-manager&from_date=2026-06-05&to_date=2026-06-05"
echo
echo "smoke-e2e completed"
