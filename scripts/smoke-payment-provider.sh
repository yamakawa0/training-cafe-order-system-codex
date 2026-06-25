#!/usr/bin/env bash
set -euo pipefail

export SMOKE_NAME="smoke-payment-provider"
# shellcheck source=scripts/lib/smoke-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/lib/smoke-lib.sh"

reset_db
login_as cashier cashier123 checkout-main

step "注文から mock provider 精算まで 1 件完了"
session_id="$(open_session customer-T01 T01)"
order_no="$(submit_order customer-T01 T01 '[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""}]')"
echo "session_id=$session_id"
echo "order_no=$order_no"
login_as kitchen kitchen123 kitchen-main
call_get "api/kitchen/tickets?terminal_code=kitchen-main"
item_id="$(first_ticket_id T01 ordered)"
make_item_ready "$item_id"
login_as hall hall123 hall-main
complete_serve_task_for_item "$item_id"
request_payment T01
login_as cashier cashier123 checkout-main

external_payment_id="mock-pay-provider-001"
settle_idem="idem-provider-settle-001"
call_post "api/checkout/settle" "{\"terminal_code\":\"checkout-main\",\"table_code\":\"T01\",\"method\":\"card\",\"provider\":\"mock\",\"external_payment_id\":\"$external_payment_id\",\"idempotency_key\":\"$settle_idem\",\"simulate_result\":\"paid\"}"
payment_id="$(extract_json 'return root.payment && root.payment.id' "mock provider payment_id が取得できません")"
payment_no="$(extract_json 'return root.payment && root.payment.payment_no' "mock provider payment_no が取得できません")"
echo "payment_id=$payment_id"
echo "payment_no=$payment_no"
assert_json 'return root.payment && root.payment.provider === "mock" && root.payment.external_payment_id === "'"$external_payment_id"'" && root.payment.idempotency_key === "'"$settle_idem"'" && root.payment.provider_status === "succeeded"' "mock provider payment response が不正です"
assert_sql "SELECT provider || '|' || external_payment_id || '|' || idempotency_key || '|' || provider_status FROM payments WHERE id = '$payment_id';" "mock|$external_payment_id|$settle_idem|succeeded" "payments の provider 情報が保存されていません"

step "同一 idempotency_key の settle 再送が二重決済にならないことを確認"
call_post "api/checkout/settle" "{\"terminal_code\":\"checkout-main\",\"table_code\":\"T01\",\"method\":\"card\",\"provider\":\"mock\",\"external_payment_id\":\"$external_payment_id\",\"idempotency_key\":\"$settle_idem\",\"simulate_result\":\"paid\"}"
assert_json 'return root.duplicate === true && root.payment && root.payment.id === "'"$payment_id"'"' "重複 settle が既存 payment を返していません"
assert_sql "SELECT COUNT(*) FROM payments WHERE idempotency_key = '$settle_idem';" "1" "同一 idempotency_key で payment が重複作成されています"

step "mock provider で部分返金し、返金 idempotency_key の再送が二重返金にならないことを確認"
external_refund_id="mock-ref-provider-001"
refund_idem="idem-provider-refund-001"
call_post "api/checkout/refund" "{\"terminal_code\":\"checkout-main\",\"payment_id\":\"$payment_id\",\"amount\":200,\"reason\":\"mock provider partial refund\",\"provider\":\"mock\",\"external_refund_id\":\"$external_refund_id\",\"idempotency_key\":\"$refund_idem\"}"
refund_id="$(extract_json 'return root.refund && root.refund.id' "refund_id が取得できません")"
assert_json 'return root.refund && root.refund.provider === "mock" && root.refund.external_refund_id === "'"$external_refund_id"'" && root.refund.idempotency_key === "'"$refund_idem"'" && root.receipt.status === "partial_refunded"' "mock provider refund response が不正です"
assert_sql "SELECT provider || '|' || external_refund_id || '|' || idempotency_key || '|' || provider_status FROM payment_refunds WHERE id = '$refund_id';" "mock|$external_refund_id|$refund_idem|succeeded" "payment_refunds の provider 情報が保存されていません"
call_post "api/checkout/refund" "{\"terminal_code\":\"checkout-main\",\"payment_id\":\"$payment_id\",\"amount\":200,\"reason\":\"mock provider partial refund duplicate\",\"provider\":\"mock\",\"external_refund_id\":\"$external_refund_id\",\"idempotency_key\":\"$refund_idem\"}"
assert_json 'return root.duplicate === true && root.refund && root.refund.id === "'"$refund_id"'"' "重複 refund が既存 refund を返していません"
assert_sql "SELECT COUNT(*) FROM payment_refunds WHERE idempotency_key = '$refund_idem';" "1" "同一 refund idempotency_key で返金が重複作成されています"
assert_sql "SELECT SUM(amount)::INTEGER FROM payment_refunds WHERE payment_id = '$payment_id' AND status = 'refunded';" "200" "重複 refund で返金額が増えています"

step "mock webhook payment.succeeded を processed として保存し provider_status を更新"
event_id="evt-provider-payment-001"
call_post "api/checkout/mock-provider/webhook" "{\"terminal_code\":\"checkout-main\",\"provider\":\"mock\",\"external_event_id\":\"$event_id\",\"event_type\":\"payment.succeeded\",\"external_payment_id\":\"$external_payment_id\",\"payload\":{\"amount\":495,\"status\":\"succeeded\"}}"
assert_json 'return root.event && root.event.status === "processed" && root.event.paymentId === "'"$payment_id"'"' "payment.succeeded webhook が processed になっていません"
assert_sql "SELECT status FROM payment_webhook_events WHERE provider = 'mock' AND external_event_id = '$event_id';" "processed" "webhook event が processed で保存されていません"
assert_sql "SELECT provider_status FROM payments WHERE id = '$payment_id';" "succeeded" "payment provider_status が更新されていません"

step "同じ webhook event の再送が duplicate として二重処理されないことを確認"
call_post "api/checkout/mock-provider/webhook" "{\"terminal_code\":\"checkout-main\",\"provider\":\"mock\",\"external_event_id\":\"$event_id\",\"event_type\":\"payment.succeeded\",\"external_payment_id\":\"$external_payment_id\",\"payload\":{\"amount\":495,\"status\":\"succeeded\"}}"
assert_json 'return root.duplicate === true && root.event && root.event.status === "processed"' "重複 webhook が duplicate として返っていません"
assert_sql "SELECT COUNT(*) FROM payment_webhook_events WHERE provider = 'mock' AND external_event_id = '$event_id';" "1" "重複 webhook event が二重保存されています"

step "存在しない external_payment_id の webhook は ignored になることを確認"
ignored_event_id="evt-provider-payment-missing"
call_post "api/checkout/mock-provider/webhook" "{\"terminal_code\":\"checkout-main\",\"provider\":\"mock\",\"external_event_id\":\"$ignored_event_id\",\"event_type\":\"payment.succeeded\",\"external_payment_id\":\"mock-pay-missing\",\"payload\":{\"amount\":100,\"status\":\"succeeded\"}}"
assert_json 'return root.event && root.event.status === "ignored" && /not found/.test(root.event.errorMessage || "")' "存在しない payment webhook が ignored になっていません"

step "receipt に provider / external_payment_id / provider_status が出ることを確認"
call_get "api/checkout/receipt?terminal_code=checkout-main&payment_id=$payment_id"
assert_json 'return root.receipt && root.receipt.provider === "mock" && root.receipt.externalPaymentId === "'"$external_payment_id"'" && root.receipt.providerStatus === "succeeded" && root.receipt.refunds.some(row => row.externalRefundId === "'"$external_refund_id"'")' "receipt の provider 情報が不正です"

step "webhook event 一覧は manager のみ参照できることを確認"
login_as cashier cashier123 checkout-main
call_get "api/checkout/webhook-events?terminal_code=checkout-main&provider=mock" rejected
login_as manager manager123 checkout-main
call_get "api/checkout/webhook-events?terminal_code=checkout-main&provider=mock"
assert_json 'return root.events && root.events.some(row => row.externalEventId === "'"$event_id"'") && root.events.some(row => row.externalEventId === "'"$ignored_event_id"'" && row.status === "ignored")' "webhook event 一覧が取得できません"

step "provider / webhook / idempotency audit log が記録されることを確認"
assert_sql_number_ge "SELECT COUNT(*) FROM audit_logs WHERE action = 'checkout_provider_payment_recorded' AND target_id = '$payment_id';" 2 "provider payment audit log がありません"
assert_sql_number_ge "SELECT COUNT(*) FROM audit_logs WHERE action = 'checkout_provider_refund_recorded' AND target_id = '$refund_id';" 2 "provider refund audit log がありません"
assert_sql_number_ge "SELECT COUNT(*) FROM audit_logs WHERE action = 'checkout_provider_webhook_received' AND target_label = '$event_id';" 1 "webhook received audit log がありません"
assert_sql_number_ge "SELECT COUNT(*) FROM audit_logs WHERE action = 'checkout_provider_webhook_processed' AND target_label = '$event_id';" 1 "webhook processed audit log がありません"
assert_sql_number_ge "SELECT COUNT(*) FROM audit_logs WHERE action = 'checkout_provider_webhook_duplicate' AND target_label = '$event_id';" 1 "webhook duplicate audit log がありません"
assert_sql_number_ge "SELECT COUNT(*) FROM audit_logs WHERE action = 'checkout_provider_webhook_ignored' AND target_label = '$ignored_event_id';" 1 "webhook ignored audit log がありません"

pass
