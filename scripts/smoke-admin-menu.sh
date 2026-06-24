#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NYAN8_BASE_URL="${NYAN8_BASE_URL:-http://localhost:8889}"
DATABASE_URL="${DATABASE_URL:-postgres://codex:codex@localhost:5432/cafe_order_system}"
ADMIN_TERMINAL="analytics-manager"
CUSTOMER_TERMINAL="customer-T01"
ITEM_ID_FILE="/tmp/cafe-order-admin-menu-item-id.txt"
CATEGORY_ID_FILE="/tmp/cafe-order-admin-menu-category-id.txt"
OPTION_ID_FILE="/tmp/cafe-order-admin-menu-option-id.txt"
CHOICE_ID_FILE="/tmp/cafe-order-admin-menu-choice-id.txt"
COOKIE_JAR="$(mktemp)"
AUTH_TOKEN=""
trap 'rm -f "$COOKIE_JAR"' EXIT

json_get() {
  local url="$1"
  if [ -n "$AUTH_TOKEN" ] && [[ "$url" != *"/api/customer/"* ]]; then
    case "$url" in
      *\?*) url="$url&token=$AUTH_TOKEN" ;;
      *) url="$url?token=$AUTH_TOKEN" ;;
    esac
    curl -sS -b "$COOKIE_JAR" -c "$COOKIE_JAR" -H "Authorization: Bearer $AUTH_TOKEN" "$url"
  else
    curl -sS -b "$COOKIE_JAR" -c "$COOKIE_JAR" "$url"
  fi
}

json_post() {
  local url="$1"
  local body="$2"
  if [ -n "$AUTH_TOKEN" ] && [[ "$url" != *"/api/customer/"* ]]; then
    body="$(printf '%s' "$body" | node -e 'let input=""; process.stdin.on("data", c => input += c); process.stdin.on("end", () => { const data = input ? JSON.parse(input) : {}; data.token = process.argv[1]; console.log(JSON.stringify(data)); });' "$AUTH_TOKEN")"
    curl -sS -b "$COOKIE_JAR" -c "$COOKIE_JAR" -H "Authorization: Bearer $AUTH_TOKEN" -H 'Content-Type: application/json' -d "$body" "$url"
  else
    curl -sS -b "$COOKIE_JAR" -c "$COOKIE_JAR" -H 'Content-Type: application/json' -d "$body" "$url"
  fi
}

node_check() {
  local expression="$1"
  node -e "let input=''; process.stdin.on('data', d => input += d); process.stdin.on('end', () => { const data = JSON.parse(input); const result = data.result || data; if (!($expression)) { console.error(JSON.stringify(data)); process.exit(1); } });"
}

sql_scalar() {
  local query="$1"
  psql "$DATABASE_URL" -Atq -c "$query"
}

sync_cookie_from_response() {
  local response="$1"
  local cookie_line
  cookie_line="$(printf '%s' "$response" | node -e '
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  try {
    const data = JSON.parse(input);
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

extract_token_from_response() {
  printf '%s' "$1" | node -e '
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  const data = JSON.parse(input);
  const header = data && data.headers && data.headers["Set-Cookie"] || "";
  const match = header.match(/cafe_session=([^;]+)/);
  if (match) process.stdout.write(decodeURIComponent(match[1]));
});'
}

echo "1 reset database"
"$ROOT_DIR/scripts/dev-reset-db.sh"

echo "1.5 login manager"
login_response="$(json_post "$NYAN8_BASE_URL/api/auth/login" '{"loginId":"manager","password":"manager123","terminalCode":"analytics-manager"}')"
sync_cookie_from_response "$login_response"
printf '%s\n' "$login_response"
printf '%s' "$login_response" | node_check "data.success === true && result.user && !result.token"
AUTH_TOKEN="$(extract_token_from_response "$login_response")"

echo "2 admin categories"
categories_response="$(json_get "$NYAN8_BASE_URL/api/admin/menu/categories?terminal_code=$ADMIN_TERMINAL")"
printf '%s\n' "$categories_response"
printf '%s' "$categories_response" | node_check "data.success === true && result.categories.length > 0"

echo "3 admin items"
items_response="$(json_get "$NYAN8_BASE_URL/api/admin/menu/items?terminal_code=$ADMIN_TERMINAL")"
printf '%s\n' "$items_response"
printf '%s' "$items_response" | node_check "data.success === true && result.items.length > 0"

echo "4 create item"
category_create_response="$(json_post "$NYAN8_BASE_URL/api/admin/menu/categories" '{"terminal_code":"analytics-manager","name":"管理テストカテゴリ","display_order":1,"active":true}')"
printf '%s\n' "$category_create_response"
printf '%s' "$category_create_response" | node_check "data.success === true && result.category.name === '管理テストカテゴリ'"
printf '%s' "$category_create_response" | node -e "let input=''; process.stdin.on('data', d => input += d); process.stdin.on('end', () => process.stdout.write(JSON.parse(input).result.category.id));" > "$CATEGORY_ID_FILE"
category_id="$(cat "$CATEGORY_ID_FILE")"

category_update_response="$(json_post "$NYAN8_BASE_URL/api/admin/menu/categories/update" "{\"terminal_code\":\"analytics-manager\",\"category_id\":\"$category_id\",\"name\":\"管理テストカテゴリ改\",\"display_order\":1,\"active\":true}")"
printf '%s\n' "$category_update_response"
printf '%s' "$category_update_response" | node_check "result.category.name === '管理テストカテゴリ改'"

category_move_response="$(json_post "$NYAN8_BASE_URL/api/admin/menu/categories/move" "{\"terminal_code\":\"analytics-manager\",\"category_id\":\"$category_id\",\"direction\":\"down\"}")"
printf '%s\n' "$category_move_response"
printf '%s' "$category_move_response" | node_check "data.success === true && result.category.id === '$category_id'"

create_body="{\"terminal_code\":\"analytics-manager\",\"category_id\":\"$category_id\",\"name\":\"管理テストコーヒー\",\"description\":\"管理 smoke 追加商品\",\"price\":777,\"tax_rate\":10,\"display_order\":5,\"active\":true,\"sold_out\":false,\"allergy_note\":\"乳\"}"
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

echo "6.5 inactive category hides its items from customer menu"
category_inactive_response="$(json_post "$NYAN8_BASE_URL/api/admin/menu/categories/toggle-active" "{\"terminal_code\":\"analytics-manager\",\"category_id\":\"$category_id\",\"active\":false}")"
printf '%s\n' "$category_inactive_response"
printf '%s' "$category_inactive_response" | node_check "result.category.active === false"
customer_category_hidden_response="$(json_get "$NYAN8_BASE_URL/api/customer/menu?terminal_code=$CUSTOMER_TERMINAL")"
printf '%s\n' "$customer_category_hidden_response"
printf '%s' "$customer_category_hidden_response" | node_check "!result.categories.flatMap(category => category.items).some(item => item.id === '$item_id')"
category_active_response="$(json_post "$NYAN8_BASE_URL/api/admin/menu/categories/toggle-active" "{\"terminal_code\":\"analytics-manager\",\"category_id\":\"$category_id\",\"active\":true}")"
printf '%s\n' "$category_active_response"
printf '%s' "$category_active_response" | node_check "result.category.active === true"

echo "7 update name and price"
update_body="{\"terminal_code\":\"analytics-manager\",\"item_id\":\"$item_id\",\"category_id\":\"cat-coffee\",\"name\":\"管理テストコーヒー改\",\"description\":\"更新済み\",\"price\":888,\"tax_rate\":10,\"display_order\":4,\"active\":true,\"sold_out\":false,\"allergy_note\":\"乳・大豆\"}"
update_response="$(json_post "$NYAN8_BASE_URL/api/admin/menu/items/update" "$update_body")"
printf '%s\n' "$update_response"
printf '%s' "$update_response" | node_check "result.item.name === '管理テストコーヒー改' && result.item.price === 888"

echo "8 update reflected in customer menu"
customer_updated_response="$(json_get "$NYAN8_BASE_URL/api/customer/menu?terminal_code=$CUSTOMER_TERMINAL")"
printf '%s\n' "$customer_updated_response"
printf '%s' "$customer_updated_response" | node_check "result.categories.flatMap(category => category.items).some(item => item.id === '$item_id' && item.name === '管理テストコーヒー改' && item.price === 888 && item.allergyNote === '乳・大豆')"

echo "8.5 create required option and priced choice"
option_create_response="$(json_post "$NYAN8_BASE_URL/api/admin/menu/items/options" "{\"terminal_code\":\"analytics-manager\",\"item_id\":\"$item_id\",\"name\":\"サイズ\",\"required\":true,\"multi_select\":false,\"min_select\":1,\"max_select\":1,\"active\":true,\"display_order\":10}")"
printf '%s\n' "$option_create_response"
printf '%s' "$option_create_response" | node_check "data.success === true && result.option.required === true"
printf '%s' "$option_create_response" | node -e "let input=''; process.stdin.on('data', d => input += d); process.stdin.on('end', () => process.stdout.write(JSON.parse(input).result.option.id));" > "$OPTION_ID_FILE"
option_id="$(cat "$OPTION_ID_FILE")"

choice_create_response="$(json_post "$NYAN8_BASE_URL/api/admin/menu/items/options/choices" "{\"terminal_code\":\"analytics-manager\",\"option_id\":\"$option_id\",\"name\":\"L\",\"price_delta\":55,\"active\":true,\"display_order\":10}")"
printf '%s\n' "$choice_create_response"
printf '%s' "$choice_create_response" | node_check "data.success === true && result.choice.priceDelta === 55"
printf '%s' "$choice_create_response" | node -e "let input=''; process.stdin.on('data', d => input += d); process.stdin.on('end', () => process.stdout.write(JSON.parse(input).result.choice.id));" > "$CHOICE_ID_FILE"
choice_id="$(cat "$CHOICE_ID_FILE")"

customer_option_response="$(json_get "$NYAN8_BASE_URL/api/customer/menu?terminal_code=$CUSTOMER_TERMINAL")"
printf '%s\n' "$customer_option_response"
printf '%s' "$customer_option_response" | node_check "result.categories.flatMap(category => category.items).some(item => item.id === '$item_id' && item.options.some(option => option.id === '$option_id' && option.choices.some(choice => choice.id === '$choice_id' && choice.priceDelta === 55)))"

echo "8.6 required option is enforced and option price is reflected"
open_response="$(json_post "$NYAN8_BASE_URL/api/customer/session/open" '{"terminal_code":"customer-T01","table_code":"T01","guest_count":1}')"
printf '%s\n' "$open_response"
printf '%s' "$open_response" | node_check "data.success === true && result.session"
reject_required_response="$(json_post "$NYAN8_BASE_URL/api/customer/order/submit" "{\"terminal_code\":\"customer-T01\",\"table_code\":\"T01\",\"items\":[{\"menu_item_id\":\"$item_id\",\"quantity\":1,\"choice_ids\":[],\"customer_note\":\"\"}]}")"
printf '%s\n' "$reject_required_response"
printf '%s' "$reject_required_response" | node_check "data.success === false && data.status === 400"
option_order_response="$(json_post "$NYAN8_BASE_URL/api/customer/order/submit" "{\"terminal_code\":\"customer-T01\",\"table_code\":\"T01\",\"items\":[{\"menu_item_id\":\"$item_id\",\"quantity\":1,\"choice_ids\":[\"$choice_id\"],\"customer_note\":\"\"}]}")"
printf '%s\n' "$option_order_response"
printf '%s' "$option_order_response" | node_check "data.success === true && result.subtotal === 943"
payment_request_response="$(json_post "$NYAN8_BASE_URL/api/customer/payment/request" '{"terminal_code":"customer-T01","table_code":"T01"}')"
printf '%s\n' "$payment_request_response"
printf '%s' "$payment_request_response" | node_check "data.success === true"
checkout_response="$(json_get "$NYAN8_BASE_URL/api/checkout/summary?terminal_code=checkout-main&table_code=T01")"
printf '%s\n' "$checkout_response"
printf '%s' "$checkout_response" | node_check "data.success === true && result.summary.subtotal === 943 && result.summary.items.some(item => item.optionsText.includes('サイズ: L'))"
settle_response="$(json_post "$NYAN8_BASE_URL/api/checkout/settle" '{"terminal_code":"checkout-main","table_code":"T01","method":"cash"}')"
printf '%s\n' "$settle_response"
printf '%s' "$settle_response" | node_check "data.success === true"
today="$(date +%F)"
analytics_response="$(json_get "$NYAN8_BASE_URL/api/analytics/summary?terminal_code=analytics-manager&from_date=$today&to_date=$today")"
printf '%s\n' "$analytics_response"
printf '%s' "$analytics_response" | node_check "data.success === true && result.summary.sales_total >= 1037"
csv_response="$(json_get "$NYAN8_BASE_URL/api/analytics/export-sales-csv?terminal_code=analytics-manager&from_date=$today&to_date=$today")"
printf '%s\n' "$csv_response"
printf '%s' "$csv_response" | node_check "data.success === true && result.csv.includes('943')"
audit_option_response="$(json_get "$NYAN8_BASE_URL/api/admin/audit-logs?terminal_code=analytics-manager&action=admin_menu_option_choice_created")"
printf '%s\n' "$audit_option_response"
printf '%s' "$audit_option_response" | node_check "data.success === true && result.logs.length > 0"

echo "8.7 inventory reservation rejects shortage and auto sold out at zero"
stock_update_response="$(json_post "$NYAN8_BASE_URL/api/admin/menu/items/update-stock" "{\"terminal_code\":\"analytics-manager\",\"item_id\":\"$item_id\",\"track_stock\":true,\"stock_quantity\":2,\"low_stock_threshold\":1}")"
printf '%s\n' "$stock_update_response"
printf '%s' "$stock_update_response" | node_check "data.success === true && result.item.trackStock === true && result.item.stockQuantity === 2 && result.item.lowStockThreshold === 1"
customer_low_stock_response="$(json_get "$NYAN8_BASE_URL/api/customer/menu?terminal_code=customer-T02")"
printf '%s\n' "$customer_low_stock_response"
printf '%s' "$customer_low_stock_response" | node_check "result.categories.flatMap(category => category.items).some(item => item.id === '$item_id' && item.trackStock === true && item.stockQuantity === 2 && item.lowStock === false)"
t02_open_response="$(json_post "$NYAN8_BASE_URL/api/customer/session/open" '{"terminal_code":"customer-T02","table_code":"T02","guest_count":1}')"
printf '%s\n' "$t02_open_response"
printf '%s' "$t02_open_response" | node_check "data.success === true && result.session"
shortage_response="$(json_post "$NYAN8_BASE_URL/api/customer/order/submit" "{\"terminal_code\":\"customer-T02\",\"table_code\":\"T02\",\"items\":[{\"menu_item_id\":\"$item_id\",\"quantity\":3,\"choice_ids\":[\"$choice_id\"],\"customer_note\":\"\"}]}")"
printf '%s\n' "$shortage_response"
printf '%s' "$shortage_response" | node_check "data.success === false && data.status === 409"
stock_after_shortage="$(sql_scalar "SELECT stock_quantity FROM menu_items WHERE id = '$item_id'")"
[ "$stock_after_shortage" = "2" ]
inventory_order_one="$(json_post "$NYAN8_BASE_URL/api/customer/order/submit" "{\"terminal_code\":\"customer-T02\",\"table_code\":\"T02\",\"items\":[{\"menu_item_id\":\"$item_id\",\"quantity\":1,\"choice_ids\":[\"$choice_id\"],\"customer_note\":\"\"}]}")"
printf '%s\n' "$inventory_order_one"
printf '%s' "$inventory_order_one" | node_check "data.success === true"
stock_after_one="$(sql_scalar "SELECT stock_quantity FROM menu_items WHERE id = '$item_id'")"
[ "$stock_after_one" = "1" ]
customer_low_stock_after_one="$(json_get "$NYAN8_BASE_URL/api/customer/menu?terminal_code=customer-T02")"
printf '%s\n' "$customer_low_stock_after_one"
printf '%s' "$customer_low_stock_after_one" | node_check "result.categories.flatMap(category => category.items).some(item => item.id === '$item_id' && item.lowStock === true && item.soldOut === false)"
inventory_order_two="$(json_post "$NYAN8_BASE_URL/api/customer/order/submit" "{\"terminal_code\":\"customer-T02\",\"table_code\":\"T02\",\"items\":[{\"menu_item_id\":\"$item_id\",\"quantity\":1,\"choice_ids\":[\"$choice_id\"],\"customer_note\":\"\"}]}")"
printf '%s\n' "$inventory_order_two"
printf '%s' "$inventory_order_two" | node_check "data.success === true"
stock_after_two="$(sql_scalar "SELECT stock_quantity || ':' || sold_out FROM menu_items WHERE id = '$item_id'")"
[ "$stock_after_two" = "0:true" ]
customer_auto_sold_out_response="$(json_get "$NYAN8_BASE_URL/api/customer/menu?terminal_code=customer-T02")"
printf '%s\n' "$customer_auto_sold_out_response"
printf '%s' "$customer_auto_sold_out_response" | node_check "result.categories.flatMap(category => category.items).some(item => item.id === '$item_id' && item.soldOut === true)"
sold_out_order_response="$(json_post "$NYAN8_BASE_URL/api/customer/order/submit" "{\"terminal_code\":\"customer-T02\",\"table_code\":\"T02\",\"items\":[{\"menu_item_id\":\"$item_id\",\"quantity\":1,\"choice_ids\":[\"$choice_id\"],\"customer_note\":\"\"}]}")"
printf '%s\n' "$sold_out_order_response"
printf '%s' "$sold_out_order_response" | node_check "data.success === false && data.status === 409"
inventory_order_two_no="$(printf '%s' "$inventory_order_two" | node -e "let input=''; process.stdin.on('data', d => input += d); process.stdin.on('end', () => process.stdout.write(JSON.parse(input).result.orderNo));")"
inventory_order_two_id="$(sql_scalar "SELECT id FROM orders WHERE order_no = '$inventory_order_two_no'")"
inventory_order_item_id="$(sql_scalar "SELECT id FROM order_items WHERE order_id = '$inventory_order_two_id' AND menu_item_id = '$item_id' LIMIT 1")"
cancel_inventory_item_response="$(json_post "$NYAN8_BASE_URL/api/admin/orders/cancel-item" "{\"terminal_code\":\"analytics-manager\",\"order_item_id\":\"$inventory_order_item_id\",\"cancel_note\":\"在庫 smoke\"}")"
printf '%s\n' "$cancel_inventory_item_response"
printf '%s' "$cancel_inventory_item_response" | node_check "data.success === true"
stock_after_cancel="$(sql_scalar "SELECT stock_quantity || ':' || sold_out FROM menu_items WHERE id = '$item_id'")"
[ "$stock_after_cancel" = "1:true" ]
stock_unsold_response="$(json_post "$NYAN8_BASE_URL/api/admin/menu/items/toggle-sold-out" "{\"terminal_code\":\"analytics-manager\",\"item_id\":\"$item_id\",\"sold_out\":false}")"
printf '%s\n' "$stock_unsold_response"
printf '%s' "$stock_unsold_response" | node_check "result.item.soldOut === false && result.item.stockQuantity === 1"
audit_stock_update_response="$(json_get "$NYAN8_BASE_URL/api/admin/audit-logs?terminal_code=analytics-manager&action=admin_menu_item_stock_updated")"
printf '%s\n' "$audit_stock_update_response"
printf '%s' "$audit_stock_update_response" | node_check "data.success === true && result.logs.length > 0"
audit_stock_reserved_response="$(json_get "$NYAN8_BASE_URL/api/admin/audit-logs?terminal_code=analytics-manager&action=customer_order_stock_reserved")"
printf '%s\n' "$audit_stock_reserved_response"
printf '%s' "$audit_stock_reserved_response" | node_check "data.success === true && result.logs.length > 0"
audit_stock_restored_response="$(json_get "$NYAN8_BASE_URL/api/admin/audit-logs?terminal_code=analytics-manager&action=admin_order_item_stock_restored")"
printf '%s\n' "$audit_stock_restored_response"
printf '%s' "$audit_stock_restored_response" | node_check "data.success === true && result.logs.length > 0"

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

echo "14 non-manager user rejected for category and option APIs"
viewer_login_response="$(json_post "$NYAN8_BASE_URL/api/auth/login" '{"loginId":"viewer","password":"viewer123","terminalCode":"analytics-manager"}')"
sync_cookie_from_response "$viewer_login_response"
AUTH_TOKEN="$(extract_token_from_response "$viewer_login_response")"
viewer_category_rejected="$(json_post "$NYAN8_BASE_URL/api/admin/menu/categories" '{"terminal_code":"analytics-manager","name":"viewer-ng","display_order":99,"active":true}')"
printf '%s\n' "$viewer_category_rejected"
printf '%s' "$viewer_category_rejected" | node_check "data.success === false && data.status === 403"
viewer_option_rejected="$(json_post "$NYAN8_BASE_URL/api/admin/menu/items/options" "{\"terminal_code\":\"analytics-manager\",\"item_id\":\"$item_id\",\"name\":\"viewer-ng\",\"required\":false,\"multi_select\":false,\"min_select\":0,\"max_select\":1,\"active\":true,\"display_order\":99}")"
printf '%s\n' "$viewer_option_rejected"
printf '%s' "$viewer_option_rejected" | node_check "data.success === false && data.status === 403"
viewer_stock_rejected="$(json_post "$NYAN8_BASE_URL/api/admin/menu/items/update-stock" "{\"terminal_code\":\"analytics-manager\",\"item_id\":\"$item_id\",\"track_stock\":true,\"stock_quantity\":5,\"low_stock_threshold\":1}")"
printf '%s\n' "$viewer_stock_rejected"
printf '%s' "$viewer_stock_rejected" | node_check "data.success === false && data.status === 403"

echo "15 existing smoke checks"
"$ROOT_DIR/scripts/smoke-menu.sh"
"$ROOT_DIR/scripts/smoke-e2e.sh"

echo "smoke-admin-menu completed"
