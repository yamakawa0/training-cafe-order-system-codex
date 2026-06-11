#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NYAN8_BASE_URL="${NYAN8_BASE_URL:-http://localhost:8889}"
ADMIN_TERMINAL="analytics-manager"
CUSTOMER_TERMINAL="customer-T01"
ITEM_ID_FILE="/tmp/cafe-order-admin-menu-item-id.txt"

json_get() {
  local url="$1"
  curl -sS "$url"
}

json_post() {
  local url="$1"
  local body="$2"
  curl -sS -H 'Content-Type: application/json' -d "$body" "$url"
}

node_check() {
  local expression="$1"
  node -e "let input=''; process.stdin.on('data', d => input += d); process.stdin.on('end', () => { const data = JSON.parse(input); const result = data.result || data; if (!($expression)) { console.error(JSON.stringify(data)); process.exit(1); } });"
}

echo "1 reset database"
"$ROOT_DIR/scripts/dev-reset-db.sh"

echo "2 admin categories"
categories_response="$(json_get "$NYAN8_BASE_URL/api/admin/menu/categories?terminal_code=$ADMIN_TERMINAL")"
printf '%s\n' "$categories_response"
printf '%s' "$categories_response" | node_check "data.success === true && result.categories.length > 0"

echo "3 admin items"
items_response="$(json_get "$NYAN8_BASE_URL/api/admin/menu/items?terminal_code=$ADMIN_TERMINAL")"
printf '%s\n' "$items_response"
printf '%s' "$items_response" | node_check "data.success === true && result.items.length > 0"

echo "4 create item"
create_body='{"terminal_code":"analytics-manager","category_id":"cat-coffee","name":"管理テストコーヒー","description":"管理 smoke 追加商品","price":777,"tax_rate":10,"display_order":5,"active":true,"sold_out":false,"allergy_note":"乳"}'
create_response="$(json_post "$NYAN8_BASE_URL/api/admin/menu/items" "$create_body")"
printf '%s\n' "$create_response"
printf '%s' "$create_response" | node_check "data.success === true && result.item.name === '管理テストコーヒー'"
printf '%s' "$create_response" | node -e "let input=''; process.stdin.on('data', d => input += d); process.stdin.on('end', () => process.stdout.write(JSON.parse(input).result.item.id));" > "$ITEM_ID_FILE"
item_id="$(cat "$ITEM_ID_FILE")"

echo "5 created item appears in admin list"
admin_created_response="$(json_get "$NYAN8_BASE_URL/api/admin/menu/items?terminal_code=$ADMIN_TERMINAL&keyword=%E7%AE%A1%E7%90%86%E3%83%86%E3%82%B9%E3%83%88")"
printf '%s\n' "$admin_created_response"
printf '%s' "$admin_created_response" | node_check "result.items.some(item => item.id === '$item_id')"

echo "6 created item appears in customer menu"
customer_created_response="$(json_get "$NYAN8_BASE_URL/api/customer/menu?terminal_code=$CUSTOMER_TERMINAL")"
printf '%s\n' "$customer_created_response"
printf '%s' "$customer_created_response" | node_check "result.categories.flatMap(category => category.items).some(item => item.id === '$item_id' && item.allergyNote === '乳')"

echo "7 update name and price"
update_body="{\"terminal_code\":\"analytics-manager\",\"item_id\":\"$item_id\",\"category_id\":\"cat-coffee\",\"name\":\"管理テストコーヒー改\",\"description\":\"更新済み\",\"price\":888,\"tax_rate\":10,\"display_order\":4,\"active\":true,\"sold_out\":false,\"allergy_note\":\"乳・大豆\"}"
update_response="$(json_post "$NYAN8_BASE_URL/api/admin/menu/items/update" "$update_body")"
printf '%s\n' "$update_response"
printf '%s' "$update_response" | node_check "result.item.name === '管理テストコーヒー改' && result.item.price === 888"

echo "8 update reflected in customer menu"
customer_updated_response="$(json_get "$NYAN8_BASE_URL/api/customer/menu?terminal_code=$CUSTOMER_TERMINAL")"
printf '%s\n' "$customer_updated_response"
printf '%s' "$customer_updated_response" | node_check "result.categories.flatMap(category => category.items).some(item => item.id === '$item_id' && item.name === '管理テストコーヒー改' && item.price === 888 && item.allergyNote === '乳・大豆')"

echo "9 mark sold out"
sold_out_response="$(json_post "$NYAN8_BASE_URL/api/admin/menu/items/toggle-sold-out" "{\"terminal_code\":\"analytics-manager\",\"item_id\":\"$item_id\",\"sold_out\":true}")"
printf '%s\n' "$sold_out_response"
printf '%s' "$sold_out_response" | node_check "result.item.soldOut === true"

echo "10 sold out reflected in customer menu"
customer_sold_out_response="$(json_get "$NYAN8_BASE_URL/api/customer/menu?terminal_code=$CUSTOMER_TERMINAL")"
printf '%s\n' "$customer_sold_out_response"
printf '%s' "$customer_sold_out_response" | node_check "result.categories.flatMap(category => category.items).some(item => item.id === '$item_id' && item.soldOut === true)"

echo "11 mark inactive"
inactive_response="$(json_post "$NYAN8_BASE_URL/api/admin/menu/items/toggle-active" "{\"terminal_code\":\"analytics-manager\",\"item_id\":\"$item_id\",\"active\":false}")"
printf '%s\n' "$inactive_response"
printf '%s' "$inactive_response" | node_check "result.item.active === false"

echo "12 inactive item hidden from customer menu"
customer_hidden_response="$(json_get "$NYAN8_BASE_URL/api/customer/menu?terminal_code=$CUSTOMER_TERMINAL")"
printf '%s\n' "$customer_hidden_response"
printf '%s' "$customer_hidden_response" | node_check "!result.categories.flatMap(category => category.items).some(item => item.id === '$item_id')"

echo "13 non-admin terminal rejected"
rejected_response="$(json_get "$NYAN8_BASE_URL/api/admin/menu/categories?terminal_code=customer-T01")"
printf '%s\n' "$rejected_response"
printf '%s' "$rejected_response" | node_check "data.success === false && data.status === 403"

echo "14 existing smoke checks"
"$ROOT_DIR/scripts/smoke-menu.sh"
"$ROOT_DIR/scripts/smoke-e2e.sh"

echo "smoke-admin-menu completed"
