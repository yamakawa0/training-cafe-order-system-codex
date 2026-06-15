#!/usr/bin/env bash
set -euo pipefail

SMOKE_NAME="smoke-auth"
source "$(cd "$(dirname "$0")" && pwd)/lib/smoke-lib.sh"

saved_token=""

save_token() {
  saved_token="$AUTH_TOKEN"
}

restore_token() {
  AUTH_TOKEN="$saved_token"
  export AUTH_TOKEN
}

without_token() {
  AUTH_TOKEN=""
  export AUTH_TOKEN
}

expect_401() {
  assert_json 'return Number(data.status) === 401' "$1"
}

expect_403() {
  assert_json 'return Number(data.status) === 403' "$1"
}

reset_db

step "manager login succeeds and /me works"
login_as manager manager123 analytics-manager
manager_token="$AUTH_TOKEN"
call_get "api/auth/me"
assert_json 'return root.user && root.user.role === "manager" && root.user.loginId === "manager"' "manager の me が不正です"

step "wrong password is rejected"
without_token
call_post "api/auth/login" '{"loginId":"manager","password":"wrong","terminalCode":"analytics-manager"}' rejected
expect_401 "誤パスワードが 401 で拒否されていません"

step "protected APIs reject missing token"
call_get "api/admin/users?terminal_code=analytics-manager" rejected
expect_401 "token なし admin が 401 ではありません"
call_get "api/analytics/summary?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY" rejected
expect_401 "token なし analytics が 401 ではありません"
call_get "api/checkout/summary?terminal_code=checkout-main&table_code=T01" rejected
expect_401 "token なし checkout が 401 ではありません"
call_get "api/kitchen/tickets?terminal_code=kitchen-main" rejected
expect_401 "token なし kitchen が 401 ではありません"
call_get "api/hall/tasks?terminal_code=hall-main" rejected
expect_401 "token なし hall が 401 ではありません"

step "nonexistent token is rejected"
AUTH_TOKEN="token-not-found"
export AUTH_TOKEN
call_get "api/admin/users?terminal_code=analytics-manager" rejected
expect_401 "存在しない token が 401 で拒否されていません"

step "viewer can use analytics but not operational/admin APIs"
login_as viewer viewer123 analytics-manager
viewer_token="$AUTH_TOKEN"
call_get "api/analytics/summary?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY"
call_get "api/analytics/item-ranking?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY"
call_get "api/analytics/export-sales-csv?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY"
call_get "api/admin/menu/items?terminal_code=analytics-manager" rejected
expect_403 "viewer の admin API が 403 ではありません"
call_get "api/checkout/summary?terminal_code=checkout-main&table_code=T01" rejected
expect_403 "viewer の checkout API が 403 ではありません"
call_get "api/kitchen/tickets?terminal_code=kitchen-main" rejected
expect_403 "viewer の kitchen API が 403 ではありません"
call_get "api/hall/tasks?terminal_code=hall-main" rejected
expect_403 "viewer の hall API が 403 ではありません"

step "expired session token is rejected"
sql_scalar "UPDATE user_sessions SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE session_token = '$viewer_token';" >/dev/null
AUTH_TOKEN="$viewer_token"
export AUTH_TOKEN
call_get "api/analytics/summary?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY" rejected
expect_401 "期限切れ token が 401 で拒否されていません"

step "inactive user cannot login and existing token is rejected"
sql_scalar "UPDATE users SET active = TRUE WHERE id = 'user-viewer';" >/dev/null
login_as viewer viewer123 analytics-manager
viewer_token="$AUTH_TOKEN"
sql_scalar "UPDATE users SET active = FALSE WHERE id = 'user-viewer';" >/dev/null
call_get "api/analytics/summary?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY" rejected
expect_401 "inactive user の既存 token が 401 で拒否されていません"
without_token
call_post "api/auth/login" '{"loginId":"viewer","password":"viewer123","terminalCode":"analytics-manager"}' rejected
expect_401 "inactive user の login が 401 で拒否されていません"
sql_scalar "UPDATE users SET active = TRUE WHERE id = 'user-viewer';" >/dev/null

step "cashier can use checkout but not admin/analytics/kitchen/hall"
login_as cashier cashier123 checkout-main
call_get "api/checkout/summary?terminal_code=checkout-main&table_code=T01"
call_get "api/admin/orders?terminal_code=analytics-manager" rejected
expect_403 "cashier の admin API が 403 ではありません"
call_get "api/analytics/summary?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY" rejected
expect_403 "cashier の analytics API が 403 ではありません"
call_get "api/kitchen/tickets?terminal_code=kitchen-main" rejected
expect_403 "cashier の kitchen API が 403 ではありません"
call_get "api/hall/tasks?terminal_code=hall-main" rejected
expect_403 "cashier の hall API が 403 ではありません"

step "kitchen can use kitchen but not hall/checkout/admin"
login_as kitchen kitchen123 kitchen-main
call_get "api/kitchen/tickets?terminal_code=kitchen-main"
call_get "api/hall/tasks?terminal_code=hall-main" rejected
expect_403 "kitchen の hall API が 403 ではありません"
call_get "api/checkout/summary?terminal_code=checkout-main&table_code=T01" rejected
expect_403 "kitchen の checkout API が 403 ではありません"
call_get "api/admin/menu/items?terminal_code=analytics-manager" rejected
expect_403 "kitchen の admin API が 403 ではありません"

step "hall can use hall but not kitchen/checkout/admin"
login_as hall hall123 hall-main
call_get "api/hall/tasks?terminal_code=hall-main"
call_get "api/kitchen/tickets?terminal_code=kitchen-main" rejected
expect_403 "hall の kitchen API が 403 ではありません"
call_get "api/checkout/summary?terminal_code=checkout-main&table_code=T01" rejected
expect_403 "hall の checkout API が 403 ではありません"
call_get "api/admin/menu/items?terminal_code=analytics-manager" rejected
expect_403 "hall の admin API が 403 ではありません"

step "manager can use admin, analytics, checkout, kitchen and hall APIs"
AUTH_TOKEN="$manager_token"
export AUTH_TOKEN
call_get "api/admin/users?terminal_code=analytics-manager"
assert_json 'return Array.isArray(root.users) && root.users.some(user => user.loginId === "manager")' "ユーザー一覧が取得できません"
call_get "api/admin/audit-logs?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY"
call_get "api/admin/menu/items?terminal_code=analytics-manager"
call_get "api/admin/tables?terminal_code=analytics-manager"
call_get "api/admin/terminals?terminal_code=analytics-manager"
call_get "api/admin/orders?terminal_code=analytics-manager"
call_get "api/analytics/summary?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY"
call_get "api/checkout/summary?terminal_code=checkout-main&table_code=T01"
call_get "api/kitchen/tickets?terminal_code=kitchen-main"
call_get "api/hall/tasks?terminal_code=hall-main"

step "last active manager cannot be disabled or demoted"
call_post "api/admin/users/toggle-active" '{"terminal_code":"analytics-manager","id":"user-manager","active":false}' rejected
assert_json 'return Number(data.status) === 409' "最後の active manager 無効化が拒否されていません"
call_post "api/admin/users/update" '{"terminal_code":"analytics-manager","id":"user-manager","display_name":"店長","role":"viewer"}' rejected
assert_json 'return Number(data.status) === 409' "自分自身または最後の manager の降格が拒否されていません"

step "customer APIs work without token"
without_token
call_get "api/customer/menu?terminal_code=customer-T01"
call_post "api/customer/session/open" '{"terminal_code":"customer-T01","table_code":"T01","guest_count":1}'
session_id="$(extract_json 'return root.session && root.session.id' "session_id が取得できません")"
call_get "api/customer/session/current?terminal_code=customer-T01&table_code=T01"
call_post "api/customer/order/submit" '{"terminal_code":"customer-T01","table_code":"T01","items":[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""}]}'
call_get "api/customer/order/history?terminal_code=customer-T01&table_code=T01&session_id=$session_id"
call_post "api/customer/staff-call" '{"terminal_code":"customer-T01","table_code":"T01","note":"水をお願いします"}'
call_post "api/customer/payment/request" '{"terminal_code":"customer-T01","table_code":"T01"}'

step "audit log records user actor for admin and terminal actor for customer"
AUTH_TOKEN="$manager_token"
export AUTH_TOKEN
call_post "api/admin/menu/items/toggle-sold-out" '{"terminal_code":"analytics-manager","item_id":"item-iced-tea","sold_out":true}'
assert_sql_number_ge "SELECT COUNT(*) FROM audit_logs WHERE action = 'admin_menu_item_sold_out_changed' AND actor_user_id = 'user-manager'" 1 "管理操作の actor_user_id が記録されていません"
assert_sql_number_ge "SELECT COUNT(*) FROM audit_logs WHERE action = 'customer_staff_called' AND actor_user_id IS NULL AND actor_terminal_code = 'customer-T01'" 1 "顧客操作の terminal actor が記録されていません"

step "protected API rejects after logout"
logout_auth
call_get "api/admin/users?terminal_code=analytics-manager" rejected
expect_401 "logout 後の protected API が 401 で拒否されていません"

pass
