#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NYAN8_BASE_URL="${NYAN8_BASE_URL:-http://localhost:8889}"
DATABASE_URL="${DATABASE_URL:-postgres://codex:codex@localhost:5432/cafe_order_system}"
ADMIN_TERMINAL="analytics-manager"
CUSTOMER_TERMINAL="customer-T01"
ITEM_ID_FILE="/tmp/cafe-order-admin-menu-item-id.txt"
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
