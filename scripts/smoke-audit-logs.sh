#!/usr/bin/env bash
set -euo pipefail

SMOKE_NAME="smoke-audit-logs"
source "$(cd "$(dirname "$0")" && pwd)/lib/smoke-lib.sh"

assert_audit_action() {
  local action="$1"
  assert_sql "SELECT COUNT(*) FROM audit_logs WHERE action = '$action' AND status = 'success';" "1" "$action の監査ログが作成されていません"
}

order_id_by_no() {
  local order_no="$1"
  call_get "api/admin/orders?terminal_code=analytics-manager&order_no=$order_no"
  extract_json "const order = (root.orders || []).find(row => row.orderNo === '$order_no'); return order && order.orderId" "$order_no の order_id が取得できません"
}

item_id_from_detail() {
  local item_name="$1"
  extract_json "const item = (root.order.items || []).find(row => row.itemName === '$item_name'); return item && item.orderItemId" "$item_name の order_item_id が取得できません"
}

reset_db
login_as manager manager123 analytics-manager

step "顧客注文を作成し customer_order_submitted を確認"
open_session customer-T01 T01 >/dev/null
order_no="$(submit_order customer-T01 T01 '[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""}]')"
assert_audit_action customer_order_submitted

step "会計依頼し customer_payment_requested を確認"
request_payment T01
assert_audit_action customer_payment_requested

step "レジ精算し checkout_settled を確認"
settle_table T01 card >/dev/null
assert_audit_action checkout_settled

step "メニュー商品を売切にし admin_menu_item_sold_out_changed を確認"
call_post "api/admin/menu/items/toggle-sold-out" '{"terminal_code":"analytics-manager","item_id":"item-iced-tea","sold_out":true}'
assert_json 'return root.item && root.item.soldOut === true' "商品が売切になっていません"
assert_audit_action admin_menu_item_sold_out_changed

step "注文明細を管理 API からキャンセルし admin_order_item_cancelled を確認"
open_session customer-T02 T02 >/dev/null
cancel_order_no="$(submit_order customer-T02 T02 '[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""}]')"
cancel_order_id="$(order_id_by_no "$cancel_order_no")"
call_get "api/admin/orders/detail?terminal_code=analytics-manager&order_id=$cancel_order_id"
cancel_item_id="$(item_id_from_detail "ブレンドコーヒー")"
call_post "api/admin/orders/cancel-item" "{\"terminal_code\":\"analytics-manager\",\"order_item_id\":\"$cancel_item_id\",\"cancel_note\":\"smoke audit\"}"
assert_json 'return root.order && root.order.items.every(item => item.status === "cancelled")' "注文明細がキャンセルされていません"
assert_audit_action admin_order_item_cancelled

step "非管理者で監査ログ API が拒否されることを確認"
call_get "api/admin/audit-logs?terminal_code=customer-T01" rejected
assert_json 'return data.status === 403' "非管理者の監査ログ一覧取得が拒否されていません"

step "管理者で監査ログ一覧を取得"
call_get "api/admin/audit-logs?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY"
assert_json 'return Array.isArray(root.logs) && root.logs.some(log => log.action === "checkout_settled")' "監査ログ一覧に checkout_settled がありません"
audit_log_id="$(extract_json 'return (root.logs || [])[0] && root.logs[0].id' "監査ログ ID が取得できません")"

step "監査ログ一覧の action filter が効く"
call_get "api/admin/audit-logs?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY&action=checkout_settled"
assert_json 'return Array.isArray(root.logs) && root.logs.length >= 1 && root.logs.every(log => log.action === "checkout_settled")' "action filter が効いていません"

step "監査ログ一覧の actor_user_role filter が効く"
call_get "api/admin/audit-logs?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY&actor_user_role=manager"
assert_json 'return Array.isArray(root.logs) && root.logs.some(log => log.action === "checkout_settled") && root.logs.every(log => log.actorUserRole === "manager")' "actor_user_role filter が効いていません"

step "監査ログ一覧の keyword filter が効く"
call_get "api/admin/audit-logs?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY&keyword=checkout_settled"
assert_json 'return Array.isArray(root.logs) && root.logs.some(log => log.action === "checkout_settled")' "keyword filter が効いていません"

step "監査ログ詳細を取得"
call_get "api/admin/audit-logs/detail?terminal_code=analytics-manager&id=$audit_log_id"
assert_json 'return root.log && root.log.id && root.log.action && root.log.requestData !== undefined' "監査ログ詳細が取得できません"
assert_json 'return root.log && Object.prototype.hasOwnProperty.call(root.log, "beforeData") && Object.prototype.hasOwnProperty.call(root.log, "afterData")' "監査ログ詳細で before/after が確認できません"

step "manager が監査ログ CSV を出力できる"
call_get "api/admin/audit-logs/export-csv?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY&action=checkout_settled"
assert_json 'return root.contentType && root.contentType.includes("text/csv") && root.filename && typeof root.csv === "string"' "監査ログ CSV レスポンスが不正です"
assert_json 'return root.csv.split(/\r?\n/)[0] === "occurred_at,status,action,actor_user_id,actor_user_display_name,actor_user_role,actor_terminal_code,actor_terminal_type,target_type,target_id,target_label,error_message,request_data,before_data,after_data"' "監査ログ CSV header が不正です"
assert_json 'return root.csv.includes("checkout_settled") && !root.csv.includes("customer_order_submitted")' "監査ログ CSV に検索条件が反映されていません"
assert_json 'return !/password/i.test(root.csv)' "監査ログ CSV に password が含まれています"
assert_json 'return !/session_token/i.test(root.csv)' "監査ログ CSV に session_token が含まれています"
assert_audit_action admin_audit_logs_exported

step "viewer / cashier / kitchen / hall は監査ログ CSV を出力できない"
login_as viewer viewer123 analytics-manager
call_get "api/admin/audit-logs/export-csv?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY" rejected
assert_json 'return data.status === 403' "viewer の監査ログ CSV 出力が拒否されていません"
login_as cashier cashier123 checkout-main
call_get "api/admin/audit-logs/export-csv?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY" rejected
assert_json 'return data.status === 403' "cashier の監査ログ CSV 出力が拒否されていません"
login_as kitchen kitchen123 kitchen-main
call_get "api/admin/audit-logs/export-csv?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY" rejected
assert_json 'return data.status === 403' "kitchen の監査ログ CSV 出力が拒否されていません"
login_as hall hall123 hall-main
call_get "api/admin/audit-logs/export-csv?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY" rejected
assert_json 'return data.status === 403' "hall の監査ログ CSV 出力が拒否されていません"

pass
