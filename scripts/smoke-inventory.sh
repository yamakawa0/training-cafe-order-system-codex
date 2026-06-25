#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NYAN8_BASE_URL="${NYAN8_BASE_URL:-http://localhost:8889}"
DATABASE_URL="${DATABASE_URL:-postgres://codex:codex@localhost:5432/cafe_order_system}"
ADMIN_TERMINAL="analytics-manager"
ITEM_ID="item-pudding"
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

echo "2 login manager"
login_response="$(json_post "$NYAN8_BASE_URL/api/auth/login" '{"loginId":"manager","password":"manager123","terminalCode":"analytics-manager"}')"
sync_cookie_from_response "$login_response"
printf '%s\n' "$login_response"
printf '%s' "$login_response" | node_check "data.success === true && result.user.role === 'manager'"
AUTH_TOKEN="$(extract_token_from_response "$login_response")"

echo "3 update-stock creates manual_set"
set_stock_response="$(json_post "$NYAN8_BASE_URL/api/admin/menu/items/update-stock" "{\"terminal_code\":\"$ADMIN_TERMINAL\",\"item_id\":\"$ITEM_ID\",\"track_stock\":true,\"stock_quantity\":2,\"low_stock_threshold\":1}")"
printf '%s\n' "$set_stock_response"
printf '%s' "$set_stock_response" | node_check "data.success === true && result.item.stockQuantity === 2"
manual_set_count="$(sql_scalar "SELECT COUNT(*) FROM inventory_movements WHERE menu_item_id = '$ITEM_ID' AND movement_type = 'manual_set' AND quantity_delta = -1 AND quantity_before = 3 AND quantity_after = 2")"
[ "$manual_set_count" = "1" ]

movements_response="$(json_get "$NYAN8_BASE_URL/api/admin/menu/items/inventory-movements?terminal_code=$ADMIN_TERMINAL&item_id=$ITEM_ID")"
printf '%s\n' "$movements_response"
printf '%s' "$movements_response" | node_check "data.success === true && result.movements.some(m => m.movementType === 'manual_set')"

echo "4 adjust-stock increases and decreases"
adjust_plus_response="$(json_post "$NYAN8_BASE_URL/api/admin/menu/items/adjust-stock" "{\"terminal_code\":\"$ADMIN_TERMINAL\",\"item_id\":\"$ITEM_ID\",\"delta\":3,\"reason\":\"smoke replenish\"}")"
printf '%s\n' "$adjust_plus_response"
printf '%s' "$adjust_plus_response" | node_check "data.success === true && result.item.stockQuantity === 5 && result.movement.movementType === 'manual_adjust'"
adjust_minus_response="$(json_post "$NYAN8_BASE_URL/api/admin/menu/items/adjust-stock" "{\"terminal_code\":\"$ADMIN_TERMINAL\",\"item_id\":\"$ITEM_ID\",\"delta\":-2,\"reason\":\"smoke reduce\"}")"
printf '%s\n' "$adjust_minus_response"
printf '%s' "$adjust_minus_response" | node_check "data.success === true && result.item.stockQuantity === 3"
manual_adjust_count="$(sql_scalar "SELECT COUNT(*) FROM inventory_movements WHERE menu_item_id = '$ITEM_ID' AND movement_type = 'manual_adjust' AND quantity_delta IN (3, -2)")"
[ "$manual_adjust_count" = "2" ]
negative_adjust_response="$(json_post "$NYAN8_BASE_URL/api/admin/menu/items/adjust-stock" "{\"terminal_code\":\"$ADMIN_TERMINAL\",\"item_id\":\"$ITEM_ID\",\"delta\":-4,\"reason\":\"too much\"}")"
printf '%s\n' "$negative_adjust_response"
printf '%s' "$negative_adjust_response" | node_check "data.success === false && data.status === 409"

echo "5 order reserve records order_reserved"
open_response="$(json_post "$NYAN8_BASE_URL/api/customer/session/open" '{"terminal_code":"customer-T01","table_code":"T01","guest_count":1}')"
printf '%s\n' "$open_response"
printf '%s' "$open_response" | node_check "data.success === true"
order_response="$(json_post "$NYAN8_BASE_URL/api/customer/order/submit" "{\"terminal_code\":\"customer-T01\",\"table_code\":\"T01\",\"items\":[{\"menu_item_id\":\"$ITEM_ID\",\"quantity\":2,\"choice_ids\":[],\"customer_note\":\"\"}]}")"
printf '%s\n' "$order_response"
printf '%s' "$order_response" | node_check "data.success === true"
stock_after_order="$(sql_scalar "SELECT stock_quantity FROM menu_items WHERE id = '$ITEM_ID'")"
[ "$stock_after_order" = "1" ]
order_no="$(printf '%s' "$order_response" | node -e "let input=''; process.stdin.on('data', d => input += d); process.stdin.on('end', () => process.stdout.write(JSON.parse(input).result.orderNo));")"
order_id="$(sql_scalar "SELECT id FROM orders WHERE order_no = '$order_no'")"
order_item_id="$(sql_scalar "SELECT id FROM order_items WHERE order_id = '$order_id' AND menu_item_id = '$ITEM_ID' LIMIT 1")"
reserved_count="$(sql_scalar "SELECT COUNT(*) FROM inventory_movements WHERE menu_item_id = '$ITEM_ID' AND movement_type = 'order_reserved' AND quantity_delta = -2 AND quantity_before = 3 AND quantity_after = 1 AND order_id = '$order_id'")"
[ "$reserved_count" = "1" ]

echo "6 cancel item records order_cancel_restored"
cancel_response="$(json_post "$NYAN8_BASE_URL/api/admin/orders/cancel-item" "{\"terminal_code\":\"$ADMIN_TERMINAL\",\"order_item_id\":\"$order_item_id\",\"cancel_note\":\"inventory smoke\"}")"
printf '%s\n' "$cancel_response"
printf '%s' "$cancel_response" | node_check "data.success === true"
stock_after_cancel="$(sql_scalar "SELECT stock_quantity || ':' || sold_out FROM menu_items WHERE id = '$ITEM_ID'")"
[ "$stock_after_cancel" = "3:false" ]
restored_count="$(sql_scalar "SELECT COUNT(*) FROM inventory_movements WHERE menu_item_id = '$ITEM_ID' AND movement_type = 'order_cancel_restored' AND quantity_delta = 2 AND quantity_before = 1 AND quantity_after = 3 AND order_item_id = '$order_item_id'")"
[ "$restored_count" = "1" ]

echo "7 zero stock auto sold out and restock does not auto unsold"
set_one_response="$(json_post "$NYAN8_BASE_URL/api/admin/menu/items/update-stock" "{\"terminal_code\":\"$ADMIN_TERMINAL\",\"item_id\":\"$ITEM_ID\",\"track_stock\":true,\"stock_quantity\":1,\"low_stock_threshold\":1}")"
printf '%s\n' "$set_one_response"
printf '%s' "$set_one_response" | node_check "data.success === true && result.item.stockQuantity === 1"
zero_response="$(json_post "$NYAN8_BASE_URL/api/admin/menu/items/adjust-stock" "{\"terminal_code\":\"$ADMIN_TERMINAL\",\"item_id\":\"$ITEM_ID\",\"delta\":-1,\"reason\":\"zero smoke\"}")"
printf '%s\n' "$zero_response"
printf '%s' "$zero_response" | node_check "data.success === true && result.item.stockQuantity === 0 && result.item.soldOut === true"
restock_response="$(json_post "$NYAN8_BASE_URL/api/admin/menu/items/adjust-stock" "{\"terminal_code\":\"$ADMIN_TERMINAL\",\"item_id\":\"$ITEM_ID\",\"delta\":1,\"reason\":\"restock smoke\"}")"
printf '%s\n' "$restock_response"
printf '%s' "$restock_response" | node_check "data.success === true && result.item.stockQuantity === 1 && result.item.soldOut === true"

echo "8 viewer cannot adjust or view inventory movements"
viewer_login_response="$(json_post "$NYAN8_BASE_URL/api/auth/login" '{"loginId":"viewer","password":"viewer123","terminalCode":"analytics-manager"}')"
sync_cookie_from_response "$viewer_login_response"
AUTH_TOKEN="$(extract_token_from_response "$viewer_login_response")"
viewer_adjust_response="$(json_post "$NYAN8_BASE_URL/api/admin/menu/items/adjust-stock" "{\"terminal_code\":\"$ADMIN_TERMINAL\",\"item_id\":\"$ITEM_ID\",\"delta\":1,\"reason\":\"viewer\"}")"
printf '%s\n' "$viewer_adjust_response"
printf '%s' "$viewer_adjust_response" | node_check "data.success === false && data.status === 403"
viewer_movements_response="$(json_get "$NYAN8_BASE_URL/api/admin/menu/items/inventory-movements?terminal_code=$ADMIN_TERMINAL&item_id=$ITEM_ID")"
printf '%s\n' "$viewer_movements_response"
printf '%s' "$viewer_movements_response" | node_check "data.success === false && data.status === 403"

echo "smoke-inventory completed"
