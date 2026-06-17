#!/usr/bin/env bash
set -euo pipefail

export SMOKE_NAME="smoke-order-multiple-items"
# shellcheck source=scripts/lib/smoke-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/lib/smoke-lib.sh"

reset_db
login_as manager manager123 analytics-manager

step "customer-T01 でセッション開始"
session_id="$(open_session customer-T01 T01)"
echo "session_id=$session_id"

step "メニュー取得"
call_get "api/customer/menu?terminal_code=customer-T01"
assert_json 'return root.categories && root.categories.length >= 2' "メニューカテゴリが不足しています"

step "2 商品以上を同一注文で注文"
order_no="$(submit_order customer-T01 T01 '[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""},{"menu_item_id":"item-iced-tea","quantity":1,"choice_ids":[],"customer_note":""}]')"
echo "order_no=$order_no"
order_id="$(sql_scalar "SELECT id FROM orders WHERE order_no = '$order_no'")"
echo "order_id=$order_id"

step "orders が 1 件、order_items が 2 件以上作成されたことを確認"
assert_sql "SELECT COUNT(*) FROM orders WHERE session_id = '$session_id'" "1" "orders が 1 件ではありません"
assert_sql_number_ge "SELECT COUNT(*) FROM order_items WHERE order_id = '$order_id'" 2 "order_items が 2 件以上ではありません"

step "片方だけ ready にしても orders.status が served にならないことを確認"
call_get "api/kitchen/tickets?terminal_code=kitchen-main"
first_item_id="$(first_ticket_id T01 ordered)"
echo "first_order_item_id=$first_item_id"
make_item_ready "$first_item_id"
not_served="$(sql_scalar "SELECT CASE WHEN status <> 'served' THEN 'ok' ELSE 'ng' END FROM orders WHERE id = '$order_id'")"
echo "order_status_check=$not_served"
[ "$not_served" = "ok" ] || fail "片方 ready の時点で orders.status が served になっています"

step "すべての明細を served にして orders.status = served を確認"
call_get "api/kitchen/tickets?terminal_code=kitchen-main"
remaining_ids="$(printf '%s' "$LAST_BODY" | json_eval "return (root.tickets || []).filter(row => row.table_code === 'T01' && row.status !== 'ready').map(row => row.order_item_id).join(',')")"
IFS=',' read -r -a remaining_array <<< "$remaining_ids"
for item_id in "${remaining_array[@]}"; do
  [ -n "$item_id" ] && make_item_ready "$item_id"
done
for item_id in $(sql_scalar "SELECT id FROM order_items WHERE order_id = '$order_id' ORDER BY created_at"); do
  complete_serve_task_for_item "$item_id"
done
assert_sql "SELECT status FROM orders WHERE id = '$order_id'" "served" "すべて served 後の orders.status が served ではありません"

step "会計金額が全明細の合計であることを確認"
request_payment T01
call_get "api/checkout/summary?terminal_code=checkout-main&table_code=T01"
assert_json 'return root.summary && root.summary.items.length === 2' "会計明細が 2 件ではありません"
assert_json 'return root.summary && root.summary.subtotal === 950 && root.summary.taxAmount === 95 && root.summary.totalAmount === 1045' "会計金額が複数明細合計と一致しません"

step "精算後、分析の商品ランキングに複数商品が反映されることを確認"
payment_id="$(settle_table T01 card)"
echo "payment_id=$payment_id"
call_get "api/analytics/item-ranking?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY"
assert_json 'return root.items && root.items.length >= 2' "商品ランキングに複数商品が反映されていません"
assert_json 'return root.items.some(item => item.menu_item_id === "item-blend") && root.items.some(item => item.menu_item_id === "item-iced-tea")' "商品ランキングに注文商品が含まれていません"

pass
