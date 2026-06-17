#!/usr/bin/env bash
set -euo pipefail

export SMOKE_NAME="smoke-invalid-operations"
# shellcheck source=scripts/lib/smoke-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/lib/smoke-lib.sh"

reset_db
login_as manager manager123 analytics-manager

step "検証用の注文、配膳、精算状態を作成"
session_id="$(open_session customer-T01 T01)"
order_no="$(submit_order customer-T01 T01 '[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""}]')"
call_get "api/kitchen/tickets?terminal_code=kitchen-main"
item_id="$(first_ticket_id T01 ordered)"
echo "session_id=$session_id"
echo "order_no=$order_no"
echo "order_item_id=$item_id"

step "端末種別違反を拒否"
call_post "api/customer/order/submit" '{"terminal_code":"kitchen-main","table_code":"T01","items":[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""}]}' rejected
call_get "api/kitchen/tickets?terminal_code=customer-T01" rejected
call_get "api/hall/tasks?terminal_code=customer-T01" rejected
call_get "api/checkout/summary?terminal_code=customer-T01&table_code=T01" rejected
call_post "api/checkout/settle" '{"terminal_code":"hall-main","table_code":"T01","method":"card"}' rejected

step "状態遷移違反 ordered -> ready を拒否"
call_post "api/kitchen/item/status" "{\"terminal_code\":\"kitchen-main\",\"order_item_id\":\"$item_id\",\"status\":\"ready\"}" rejected

step "ready -> accepted と served -> cooking を拒否"
make_item_ready "$item_id"
call_post "api/kitchen/item/status" "{\"terminal_code\":\"kitchen-main\",\"order_item_id\":\"$item_id\",\"status\":\"accepted\"}" rejected
complete_serve_task_for_item "$item_id"
call_post "api/kitchen/item/status" "{\"terminal_code\":\"kitchen-main\",\"order_item_id\":\"$item_id\",\"status\":\"cooking\"}" rejected

step "cancelled -> cooking を拒否"
reset_db
session_id="$(open_session customer-T01 T01)"
order_no="$(submit_order customer-T01 T01 '[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""}]')"
call_get "api/kitchen/tickets?terminal_code=kitchen-main"
cancel_item_id="$(first_ticket_id T01 ordered)"
call_post "api/kitchen/item/status" "{\"terminal_code\":\"kitchen-main\",\"order_item_id\":\"$cancel_item_id\",\"status\":\"cancelled\"}"
call_post "api/kitchen/item/status" "{\"terminal_code\":\"kitchen-main\",\"order_item_id\":\"$cancel_item_id\",\"status\":\"cooking\"}" rejected

step "完了済み hall task の再完了、精算済み再精算、会計依頼後追加注文を拒否"
reset_db
session_id="$(open_session customer-T01 T01)"
order_no="$(submit_order customer-T01 T01 '[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""}]')"
call_get "api/kitchen/tickets?terminal_code=kitchen-main"
item_id="$(first_ticket_id T01 ordered)"
make_item_ready "$item_id"
complete_serve_task_for_item "$item_id"
serve_task_id="$(sql_scalar "SELECT id FROM hall_tasks WHERE order_item_id = '$item_id'")"
call_post "api/hall/task/status" "{\"terminal_code\":\"hall-main\",\"task_id\":\"$serve_task_id\",\"status\":\"done\"}" rejected
call_get "api/hall/tasks?terminal_code=hall-main"
assert_json 'return (root.tasks || []).length === 0' "完了済み hall task が対応中一覧に残っています"
request_payment T01
call_post "api/customer/order/submit" '{"terminal_code":"customer-T01","table_code":"T01","items":[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""}]}' rejected
payment_id="$(settle_table T01 card)"
echo "payment_id=$payment_id"
call_post "api/checkout/settle" '{"terminal_code":"checkout-main","table_code":"T01","method":"card"}' rejected

step "存在しない ID / table_code / terminal_code を拒否"
call_post "api/kitchen/item/status" '{"terminal_code":"kitchen-main","order_item_id":"oi-not-found","status":"accepted"}' rejected
call_post "api/hall/task/status" '{"terminal_code":"hall-main","task_id":"task-not-found","status":"doing"}' rejected
call_get "api/checkout/summary?terminal_code=checkout-main&table_code=T99" rejected
call_get "api/bootstrap?terminal_code=terminal-not-found" rejected

pass
