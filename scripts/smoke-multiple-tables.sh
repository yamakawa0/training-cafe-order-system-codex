#!/usr/bin/env bash
set -euo pipefail

SMOKE_NAME="smoke-multiple-tables"
source "$(cd "$(dirname "$0")" && pwd)/lib/smoke-lib.sh"

reset_db
login_as manager manager123 analytics-manager

step "customer-T01 と customer-T02 で別々にセッション開始"
t01_session_id="$(open_session customer-T01 T01)"
t02_session_id="$(open_session customer-T02 T02)"
echo "t01_session_id=$t01_session_id"
echo "t02_session_id=$t02_session_id"
[ "$t01_session_id" != "$t02_session_id" ] || fail "T01 と T02 の session_id が同じです"

step "それぞれ別の商品を注文"
t01_order_no="$(submit_order customer-T01 T01 '[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""}]')"
t02_order_no="$(submit_order customer-T02 T02 '[{"menu_item_id":"item-iced-tea","quantity":1,"choice_ids":[],"customer_note":""}]')"
echo "t01_order_no=$t01_order_no"
echo "t02_order_no=$t02_order_no"

step "キッチン API に両方の注文が表示されることを確認"
call_get "api/kitchen/tickets?terminal_code=kitchen-main"
assert_json 'return (root.tickets || []).some(row => row.table_code === "T01") && (root.tickets || []).some(row => row.table_code === "T02")' "キッチンに T01/T02 の両方が表示されていません"
t01_item_id="$(first_ticket_id T01 ordered)"
t02_item_id="$(first_ticket_id T02 ordered)"
echo "t01_order_item_id=$t01_item_id"
echo "t02_order_item_id=$t02_item_id"

step "T01 のみ ready にし、ホールには T01 の配膳タスクだけが先に出ることを確認"
make_item_ready "$t01_item_id"
call_get "api/hall/tasks?terminal_code=hall-main"
assert_json 'return (root.tasks || []).some(row => row.table_code === "T01" && row.task_type === "serve_item")' "T01 の配膳タスクがありません"
assert_json 'return !(root.tasks || []).some(row => row.table_code === "T02" && row.task_type === "serve_item")' "T02 の配膳タスクが先に出ています"

step "T01 を精算・片付け完了"
complete_serve_task_for_item "$t01_item_id"
request_payment T01
payment_id="$(settle_table T01 card)"
echo "t01_payment_id=$payment_id"
complete_clean_task_for_table T01

step "T02 のセッションや注文が影響を受けていないことを確認"
assert_sql "SELECT status FROM table_sessions WHERE id = '$t02_session_id'" "ordering" "T02 session status が維持されていません"
assert_sql "SELECT status FROM order_items WHERE id = '$t02_item_id'" "ordered" "T02 order_item status が維持されていません"
call_get "api/kitchen/tickets?terminal_code=kitchen-main"
assert_json 'return (root.tickets || []).some(row => row.table_code === "T02" && row.status === "ordered")' "T02 の注文がキッチンに残っていません"

step "T01 の席だけ available、T02 は occupied であることを確認"
assert_sql "SELECT status FROM cafe_tables WHERE table_code = 'T01'" "available" "T01 が available に戻っていません"
assert_sql "SELECT status FROM cafe_tables WHERE table_code = 'T02'" "occupied" "T02 が occupied のままではありません"

pass
