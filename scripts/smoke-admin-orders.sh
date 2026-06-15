#!/usr/bin/env bash
set -euo pipefail

SMOKE_NAME="smoke-admin-orders"
source "$(cd "$(dirname "$0")" && pwd)/lib/smoke-lib.sh"

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

step "管理者端末で注文一覧を取得"
call_get "api/admin/orders?terminal_code=analytics-manager"
assert_json 'return Array.isArray(root.orders)' "注文一覧が取得できません"

step "非管理者端末で注文管理 API が拒否されることを確認"
call_get "api/admin/orders?terminal_code=customer-T01" rejected
assert_json 'return data.status === 403 && data.message === "管理者端末ではありません"' "非管理端末の拒否レスポンスが不正です"

step "単品注文を明細取消し、注文全体が cancelled になることを確認"
open_session customer-T01 T01 >/dev/null
single_order_no="$(submit_order customer-T01 T01 '[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""}]')"
single_order_id="$(order_id_by_no "$single_order_no")"
call_get "api/admin/orders/detail?terminal_code=analytics-manager&order_id=$single_order_id"
single_item_id="$(item_id_from_detail "ブレンドコーヒー")"
call_post "api/admin/orders/cancel-item" "{\"terminal_code\":\"analytics-manager\",\"order_item_id\":\"$single_item_id\",\"cancel_note\":\"smoke single item\"}"
assert_json 'return root.order && root.order.orderStatus === "cancelled" && root.order.items.every(item => item.status === "cancelled")' "単品注文の明細取消後に注文が cancelled になっていません"

step "複数明細の一部取消後、会計サマリから取消明細が除外されることを確認"
reset_db
open_session customer-T01 T01 >/dev/null
mixed_order_no="$(submit_order customer-T01 T01 '[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""},{"menu_item_id":"item-iced-tea","quantity":1,"choice_ids":[],"customer_note":""}]')"
mixed_order_id="$(order_id_by_no "$mixed_order_no")"
call_get "api/admin/orders/detail?terminal_code=analytics-manager&order_id=$mixed_order_id"
blend_item_id="$(item_id_from_detail "ブレンドコーヒー")"
call_post "api/admin/orders/cancel-item" "{\"terminal_code\":\"analytics-manager\",\"order_item_id\":\"$blend_item_id\",\"cancel_note\":\"smoke partial\"}"
assert_json 'return root.order.orderStatus !== "cancelled" && root.order.items.some(item => item.itemName === "ブレンドコーヒー" && item.status === "cancelled") && root.order.items.some(item => item.itemName === "アイスティー" && item.status !== "cancelled")' "一部明細取消後の注文状態が不正です"
call_get "api/checkout/summary?terminal_code=checkout-main&table_code=T01"
assert_json 'return root.summary && root.summary.totalAmount === 550 && root.summary.items.length === 1 && root.summary.items[0].itemName === "アイスティー"' "会計サマリから取消明細が除外されていません"

step "一部取消後に精算し、分析ランキングへ取消明細が入らないことを確認"
call_get "api/kitchen/tickets?terminal_code=kitchen-main"
tea_item_id="$(first_ticket_id T01 ordered)"
make_item_ready "$tea_item_id"
complete_serve_task_for_item "$tea_item_id"
request_payment T01
settle_table T01 card >/dev/null
call_get "api/analytics/item-ranking?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY"
assert_json 'return (root.items || []).some(item => item.item_name === "アイスティー" && item.quantity === 1 && item.sales_total === 500) && !(root.items || []).some(item => item.item_name === "ブレンドコーヒー")' "分析ランキングに取消明細が含まれています"

step "ready 明細の取消が拒否されることを確認"
reset_db
open_session customer-T01 T01 >/dev/null
ready_order_no="$(submit_order customer-T01 T01 '[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""}]')"
ready_order_id="$(order_id_by_no "$ready_order_no")"
call_get "api/kitchen/tickets?terminal_code=kitchen-main"
ready_item_id="$(first_ticket_id T01 ordered)"
make_item_ready "$ready_item_id"
call_post "api/admin/orders/cancel-item" "{\"terminal_code\":\"analytics-manager\",\"order_item_id\":\"$ready_item_id\",\"cancel_note\":\"smoke ready reject\"}" rejected
assert_json 'return data.status === 409' "ready 明細の取消が拒否されていません"
call_post "api/admin/orders/cancel-order" "{\"terminal_code\":\"analytics-manager\",\"order_id\":\"$ready_order_id\",\"cancel_note\":\"smoke ready order reject\"}" rejected
assert_json 'return data.status === 409' "ready 明細を含む注文全体取消が拒否されていません"

step "精算済み注文の取消が拒否されることを確認"
reset_db
open_session customer-T01 T01 >/dev/null
paid_order_no="$(submit_order customer-T01 T01 '[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""}]')"
paid_order_id="$(order_id_by_no "$paid_order_no")"
call_get "api/kitchen/tickets?terminal_code=kitchen-main"
paid_item_id="$(first_ticket_id T01 ordered)"
make_item_ready "$paid_item_id"
complete_serve_task_for_item "$paid_item_id"
request_payment T01
settle_table T01 card >/dev/null
call_post "api/admin/orders/cancel-order" "{\"terminal_code\":\"analytics-manager\",\"order_id\":\"$paid_order_id\",\"cancel_note\":\"smoke paid reject\"}" rejected
assert_json 'return data.status === 409' "精算済み注文の注文取消が拒否されていません"
call_post "api/admin/orders/cancel-item" "{\"terminal_code\":\"analytics-manager\",\"order_item_id\":\"$paid_item_id\",\"cancel_note\":\"smoke paid item reject\"}" rejected
assert_json 'return data.status === 409' "精算済み注文の明細取消が拒否されていません"

step "既存 smoke の継続成功を確認"
reset_db
"$ROOT_DIR/scripts/smoke-e2e.sh"

pass
