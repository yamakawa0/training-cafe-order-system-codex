#!/usr/bin/env bash
set -euo pipefail

SMOKE_NAME="smoke-auth"
source "$(cd "$(dirname "$0")" && pwd)/lib/smoke-lib.sh"

reset_db

step "manager login succeeds"
login_as manager manager123 analytics-manager
manager_token="$AUTH_TOKEN"
call_get "api/auth/me"
assert_json 'return root.user && root.user.role === "manager"' "manager の me が不正です"

step "wrong password is rejected"
AUTH_TOKEN=""
call_post "api/auth/login" '{"loginId":"manager","password":"wrong","terminalCode":"analytics-manager"}' rejected
assert_json 'return data.status === 401' "誤パスワードが 401 で拒否されていません"

step "viewer can use analytics but not admin"
login_as viewer viewer123 analytics-manager
call_get "api/analytics/summary?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY"
call_get "api/admin/menu/items?terminal_code=analytics-manager" rejected
assert_json 'return data.status === 403' "viewer の admin API が拒否されていません"

step "cashier can use checkout summary but not admin"
login_as cashier cashier123 checkout-main
call_get "api/checkout/summary?terminal_code=checkout-main&table_code=T01"
call_get "api/admin/orders?terminal_code=analytics-manager" rejected

step "kitchen can use kitchen API"
login_as kitchen kitchen123 kitchen-main
call_get "api/kitchen/tickets?terminal_code=kitchen-main"

step "hall can use hall API"
login_as hall hall123 hall-main
call_get "api/hall/tasks?terminal_code=hall-main"

step "manager can use admin users API"
AUTH_TOKEN="$manager_token"
call_get "api/admin/users?terminal_code=analytics-manager"
assert_json 'return Array.isArray(root.users) && root.users.some(user => user.loginId === "manager")' "ユーザー一覧が取得できません"

step "protected API rejects after logout"
logout_auth
call_get "api/admin/users?terminal_code=analytics-manager" rejected
assert_json 'return data.status === 401' "logout 後の protected API が拒否されていません"

step "audit log has actor_user_id"
login_as manager manager123 analytics-manager
call_post "api/admin/menu/items/toggle-sold-out" '{"terminal_code":"analytics-manager","item_id":"item-iced-tea","sold_out":true}'
assert_sql_number_ge "SELECT COUNT(*) FROM audit_logs WHERE action = 'admin_menu_item_sold_out_changed' AND actor_user_id = 'user-manager'" 1 "監査ログに actor_user_id が記録されていません"

pass
