#!/usr/bin/env bash
set -euo pipefail

SMOKE_NAME="smoke-admin-tables"
source "$(cd "$(dirname "$0")" && pwd)/lib/smoke-lib.sh"

reset_db
login_as manager manager123 analytics-manager

step "管理者端末で席一覧取得"
call_get "api/admin/tables?terminal_code=analytics-manager"
assert_json 'return (root.tables || []).length >= 4' "席一覧が取得できません"

step "管理者端末で端末一覧取得"
call_get "api/admin/terminals?terminal_code=analytics-manager"
assert_json 'return (root.terminals || []).some(terminal => terminal.terminalCode === "customer-T01") && (root.terminals || []).some(terminal => terminal.terminalCode === "analytics-manager")' "端末一覧が取得できません"

step "非管理者端末で admin tables が拒否されることを確認"
call_get "api/admin/tables?terminal_code=customer-T01" rejected
assert_json 'return data.status === 403 && data.message === "管理者端末ではありません"' "非管理端末の拒否レスポンスが不正です"

step "customer-T01 で注文なしセッション開始"
session_no_order="$(open_session customer-T01 T01)"
echo "session_no_order=$session_no_order"

step "管理画面 API で T01 が利用中として見えることを確認"
call_get "api/admin/tables/detail?terminal_code=analytics-manager&table_code=T01"
assert_json "return root.table && root.table.currentSessionId === '$session_no_order' && root.table.status === 'occupied' && root.table.orderCount === 0" "T01 の利用中状態が管理 API に反映されていません"

step "注文なしセッションを強制クローズ"
call_post "api/admin/tables/force-close-session" "{\"terminal_code\":\"analytics-manager\",\"session_id\":\"$session_no_order\"}"
assert_json 'return root.session && root.session.table_status === "available"' "注文なしセッションを強制クローズできません"
assert_sql "SELECT status FROM cafe_tables WHERE table_code = 'T01'" "available" "強制クローズ後に T01 が available ではありません"

step "注文あり未精算セッションの強制クローズが拒否されることを確認"
session_unpaid="$(open_session customer-T01 T01)"
echo "session_unpaid=$session_unpaid"
submit_order customer-T01 T01 '[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""}]' >/dev/null
call_post "api/admin/tables/force-close-session" "{\"terminal_code\":\"analytics-manager\",\"session_id\":\"$session_unpaid\"}" rejected
assert_json 'return data.status === 409' "未精算注文ありセッションの強制クローズが拒否されていません"

step "未精算注文を精算済みにする"
call_get "api/kitchen/tickets?terminal_code=kitchen-main"
item_id="$(first_ticket_id T01 ordered)"
echo "order_item_id=$item_id"
make_item_ready "$item_id"
complete_serve_task_for_item "$item_id"
request_payment T01
payment_id="$(settle_table T01 card)"
echo "payment_id=$payment_id"

step "精算済みセッションを強制クローズ"
call_post "api/admin/tables/force-close-session" "{\"terminal_code\":\"analytics-manager\",\"session_id\":\"$session_unpaid\"}"
assert_json 'return root.session && root.session.table_status === "available"' "精算済みセッションを強制クローズできません"
assert_sql "SELECT status FROM table_sessions WHERE id = '$session_unpaid'" "closed" "精算済みセッションが closed になっていません"
assert_sql "SELECT status FROM cafe_tables WHERE table_code = 'T01'" "available" "精算済み強制クローズ後に T01 が available ではありません"

step "顧客端末を無効化"
call_post "api/admin/terminals/update-active" '{"terminal_code":"analytics-manager","target_terminal_code":"customer-T01","active":false}'
assert_json 'return root.terminal && root.terminal.terminalCode === "customer-T01" && root.terminal.active === false' "customer-T01 を無効化できません"

step "無効化された端末からセッション開始が拒否されることを確認"
call_post "api/customer/session/open" '{"terminal_code":"customer-T01","table_code":"T01","guest_count":1}' rejected
assert_json 'return data.status === 403 && data.message === "この端末は無効です"' "無効端末の操作拒否レスポンスが不正です"

step "analytics-manager は無効化できないことを確認"
call_post "api/admin/terminals/update-active" '{"terminal_code":"analytics-manager","target_terminal_code":"analytics-manager","active":false}' rejected
assert_json 'return data.status === 409' "analytics-manager の無効化が拒否されていません"

step "顧客端末を再度有効化"
call_post "api/admin/terminals/update-active" '{"terminal_code":"analytics-manager","target_terminal_code":"customer-T01","active":true}'
assert_json 'return root.terminal && root.terminal.terminalCode === "customer-T01" && root.terminal.active === true' "customer-T01 を再有効化できません"

step "既存 smoke の継続成功を確認"
"$ROOT_DIR/scripts/smoke-menu.sh"
"$ROOT_DIR/scripts/smoke-e2e.sh"
"$ROOT_DIR/scripts/smoke-admin-menu.sh"

pass
