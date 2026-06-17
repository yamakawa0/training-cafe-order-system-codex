#!/usr/bin/env bash
set -euo pipefail

export SMOKE_NAME="smoke-cancel-flow"
# shellcheck source=scripts/lib/smoke-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/lib/smoke-lib.sh"

create_single_order() {
  local transition_to="${1:-}"
  reset_db
login_as manager manager123 analytics-manager
  session_id="$(open_session customer-T01 T01)"
  order_no="$(submit_order customer-T01 T01 '[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""}]')"
  order_id="$(sql_scalar "SELECT id FROM orders WHERE order_no = '$order_no'")"
  call_get "api/kitchen/tickets?terminal_code=kitchen-main"
  item_id="$(first_ticket_id T01 ordered)"
  if [ "$transition_to" = "accepted" ]; then transition_item "$item_id" accepted; fi
  if [ "$transition_to" = "cooking" ]; then transition_item "$item_id" accepted; transition_item "$item_id" cooking; fi
  if [ "$transition_to" = "ready" ]; then make_item_ready "$item_id"; fi
  echo "session_id=$session_id order_id=$order_id order_item_id=$item_id"
}

step "ordered -> cancelled が可能で、全明細 cancelled の注文ヘッダが cancelled になることを確認"
create_single_order
call_post "api/kitchen/item/status" "{\"terminal_code\":\"kitchen-main\",\"order_item_id\":\"$item_id\",\"status\":\"cancelled\"}"
assert_json 'return root.item && root.item.status === "cancelled"' "ordered -> cancelled に失敗しました"
assert_sql "SELECT status FROM orders WHERE id = '$order_id'" "cancelled" "全明細 cancelled の orders.status が cancelled ではありません"

step "accepted -> cancelled が可能であることを確認"
create_single_order accepted
call_post "api/kitchen/item/status" "{\"terminal_code\":\"kitchen-main\",\"order_item_id\":\"$item_id\",\"status\":\"cancelled\"}"
assert_json 'return root.item && root.item.status === "cancelled"' "accepted -> cancelled に失敗しました"

step "cooking -> cancelled が可能であることを確認"
create_single_order cooking
call_post "api/kitchen/item/status" "{\"terminal_code\":\"kitchen-main\",\"order_item_id\":\"$item_id\",\"status\":\"cancelled\"}"
assert_json 'return root.item && root.item.status === "cancelled"' "cooking -> cancelled に失敗しました"

step "ready -> cancelled は MVP では拒否されることを確認"
create_single_order ready
call_post "api/kitchen/item/status" "{\"terminal_code\":\"kitchen-main\",\"order_item_id\":\"$item_id\",\"status\":\"cancelled\"}" rejected

step "一部 served / 一部 cancelled の注文集約と会計対象を確認"
reset_db
session_id="$(open_session customer-T01 T01)"
order_no="$(submit_order customer-T01 T01 '[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""},{"menu_item_id":"item-iced-tea","quantity":1,"choice_ids":[],"customer_note":""}]')"
order_id="$(sql_scalar "SELECT id FROM orders WHERE order_no = '$order_no'")"
blend_item_id="$(sql_scalar "SELECT id FROM order_items WHERE order_id = '$order_id' AND menu_item_id = 'item-blend'")"
tea_item_id="$(sql_scalar "SELECT id FROM order_items WHERE order_id = '$order_id' AND menu_item_id = 'item-iced-tea'")"
call_post "api/kitchen/item/status" "{\"terminal_code\":\"kitchen-main\",\"order_item_id\":\"$tea_item_id\",\"status\":\"cancelled\"}"
make_item_ready "$blend_item_id"
complete_serve_task_for_item "$blend_item_id"
assert_sql "SELECT status FROM orders WHERE id = '$order_id'" "served" "一部 served / 一部 cancelled の orders.status が served ではありません"

step "キャンセル明細が会計金額に含まれないことを確認"
request_payment T01
call_get "api/checkout/summary?terminal_code=checkout-main&table_code=T01"
assert_json 'return root.summary && root.summary.items.length === 1 && root.summary.subtotal === 450 && root.summary.totalAmount === 495' "キャンセル明細が会計対象外になっていません"
payment_id="$(settle_table T01 card)"
echo "payment_id=$payment_id"

step "キャンセル明細が分析売上に含まれないことを確認"
call_get "api/analytics/item-ranking?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY"
assert_json 'return root.items && root.items.length === 1 && root.items[0].menu_item_id === "item-blend" && root.items[0].sales_total === 450' "キャンセル明細が分析に含まれています"

pass
