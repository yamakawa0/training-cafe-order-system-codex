#!/usr/bin/env bash
set -euo pipefail

export SMOKE_NAME="smoke-daily-close"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/smoke-lib.sh
source "$SCRIPT_DIR/lib/smoke-lib.sh"

prepare_payment_requested_order() {
  local table="$1"
  open_session "customer-$table" "$table" >/dev/null
  submit_order "customer-$table" "$table" '[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""}]' >/dev/null
  call_get "api/kitchen/tickets?terminal_code=kitchen-main"
  local item_id
  item_id="$(first_ticket_id "$table" ordered)"
  make_item_ready "$item_id"
  complete_serve_task_for_item "$item_id"
  request_payment "$table"
}

reset_db
login_as manager manager123 analytics-manager

step "cash/internal の paid payment を作成"
prepare_payment_requested_order T01
cash_payment_id="$(settle_table T01 cash)"
echo "cash_payment_id=$cash_payment_id"
complete_clean_task_for_table T01

step "mock/card の partial_refunded payment を作成"
prepare_payment_requested_order T01
external_payment_id="mock-daily-close-pay-001"
call_post "api/checkout/settle" "{\"terminal_code\":\"checkout-main\",\"table_code\":\"T01\",\"method\":\"card\",\"provider\":\"mock\",\"external_payment_id\":\"$external_payment_id\",\"idempotency_key\":\"daily-close-settle-001\",\"simulate_result\":\"paid\"}"
mock_payment_id="$(extract_json 'return root.payment && root.payment.id' "mock payment_id が取得できません")"
echo "mock_payment_id=$mock_payment_id"
call_post "api/checkout/refund" "{\"terminal_code\":\"checkout-main\",\"payment_id\":\"$mock_payment_id\",\"amount\":200,\"reason\":\"daily close partial refund\",\"provider\":\"mock\",\"external_refund_id\":\"mock-daily-close-refund-001\",\"idempotency_key\":\"daily-close-refund-001\"}"
assert_json 'return root.receipt && Number(root.receipt.refundTotal) === 200 && root.receipt.status === "partial_refunded"' "部分返金後の receipt が不正です"
complete_clean_task_for_table T01

step "failed attempt を作成"
prepare_payment_requested_order T01
call_post "api/checkout/settle" "{\"terminal_code\":\"checkout-main\",\"table_code\":\"T01\",\"method\":\"qr\",\"simulate_result\":\"failed\",\"failure_reason\":\"daily close failed\"}"
failed_attempt_id="$(extract_json 'return root.paymentAttempt && root.paymentAttempt.attemptId' "failed attempt id が取得できません")"
echo "failed_attempt_id=$failed_attempt_id"

step "cancelled attempt を作成"
prepare_payment_requested_order T02
call_post "api/checkout/settle" "{\"terminal_code\":\"checkout-main\",\"table_code\":\"T02\",\"method\":\"card\",\"simulate_result\":\"failed\",\"failure_reason\":\"daily close cancel target\"}"
cancel_attempt_id="$(extract_json 'return root.paymentAttempt && root.paymentAttempt.attemptId' "cancel attempt id が取得できません")"
call_post "api/checkout/cancel-payment" "{\"terminal_code\":\"checkout-main\",\"attempt_id\":\"$cancel_attempt_id\",\"reason\":\"daily close cancel\"}"
assert_json 'return root.attempt && root.attempt.status === "cancelled"' "attempt が cancelled になっていません"

step "daily-close preview の集計を確認"
call_get "api/analytics/daily-close/preview?terminal_code=analytics-manager&business_date=$TODAY"
assert_json 'return root.preview && Number(root.preview.grossSalesTotal) === 990' "grossSalesTotal が不正です"
assert_json 'return root.preview && Number(root.preview.refundTotal) === 200' "refundTotal が不正です"
assert_json 'return root.preview && Number(root.preview.netSalesTotal) === 790' "netSalesTotal が不正です"
assert_json 'return root.preview && Number(root.preview.cashTotal) === 495 && Number(root.preview.cardTotal) === 295 && Number(root.preview.qrTotal) === 0' "method total が不正です"
assert_json 'return root.preview && Number(root.preview.internalProviderTotal) === 495 && Number(root.preview.mockProviderTotal) === 295' "provider total が不正です"
assert_json 'return root.preview && Number(root.preview.paidCount) === 1 && Number(root.preview.partialRefundedCount) === 1 && Number(root.preview.refundedCount) === 0 && Number(root.preview.failedCount) === 1 && Number(root.preview.cancelledCount) === 1 && Number(root.preview.refundCount) === 1' "status count が不正です"

step "manager が daily close でき、二重 close は拒否される"
call_post "api/analytics/daily-close/close" "{\"terminal_code\":\"analytics-manager\",\"business_date\":\"$TODAY\",\"note\":\"daily close smoke\"}"
closure_id="$(extract_json 'return root.closure && root.closure.id' "closure id が取得できません")"
echo "closure_id=$closure_id"
assert_json 'return root.closure && root.closure.status === "closed" && Number(root.closure.netSalesTotal) === 790' "daily close response が不正です"
assert_sql "SELECT status || '|' || gross_sales_total || '|' || refund_total || '|' || net_sales_total FROM daily_cash_closures WHERE business_date = '$TODAY';" "closed|990|200|790" "daily_cash_closures に closed row が保存されていません"
call_post "api/analytics/daily-close/close" "{\"terminal_code\":\"analytics-manager\",\"business_date\":\"$TODAY\",\"note\":\"duplicate\"}" rejected
assert_json 'return /already closed/.test(data.message || "")' "二重 close の拒否理由が不正です"

step "viewer は閲覧と CSV ができるが close できない"
login_as viewer viewer123 analytics-manager
call_get "api/analytics/daily-close/preview?terminal_code=analytics-manager&business_date=$TODAY"
call_get "api/analytics/daily-close/list?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY"
assert_json 'return (root.closures || []).some(row => row.businessDate === "'"$TODAY"'")' "viewer list に closure がありません"
call_get "api/analytics/daily-close/detail?terminal_code=analytics-manager&business_date=$TODAY"
assert_json 'return root.closure && root.closure.status === "closed"' "viewer detail が不正です"
call_get "api/analytics/daily-close/export-csv?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY"
assert_json 'return root.csv && root.csv.includes("business_date,status") && root.csv.includes("'"$TODAY"',closed")' "daily close CSV が不正です"
call_post "api/analytics/daily-close/close" "{\"terminal_code\":\"analytics-manager\",\"business_date\":\"$TODAY\",\"note\":\"viewer close\"}" rejected
assert_json 'return Number(data.status) === 403' "viewer close が 403 ではありません"

step "manager が reopen し、再 close できる"
login_as manager manager123 analytics-manager
call_post "api/analytics/daily-close/reopen" "{\"terminal_code\":\"analytics-manager\",\"business_date\":\"$TODAY\",\"reason\":\"smoke reopen\"}"
assert_json 'return root.closure && root.closure.status === "reopened" && root.closure.reopenReason === "smoke reopen"' "reopen response が不正です"
assert_sql "SELECT status FROM daily_cash_closures WHERE business_date = '$TODAY';" "reopened" "daily close が reopened になっていません"
call_post "api/analytics/daily-close/close" "{\"terminal_code\":\"analytics-manager\",\"business_date\":\"$TODAY\",\"note\":\"daily close smoke reclose\"}"
assert_json 'return root.closure && root.closure.status === "closed" && Number(root.closure.netSalesTotal) === 790' "再 close response が不正です"
assert_sql "SELECT status || '|' || note FROM daily_cash_closures WHERE business_date = '$TODAY';" "closed|daily close smoke reclose" "再 close で row が更新されていません"

step "日次締め API は analytics 端末以外では使えない"
call_get "api/analytics/daily-close/preview?terminal_code=checkout-main&business_date=$TODAY" rejected
assert_json 'return Number(data.status) === 403' "checkout terminal の daily close preview が拒否されていません"

step "audit log に日次締め操作が記録される"
assert_sql_number_ge "SELECT COUNT(*) FROM audit_logs WHERE action = 'analytics_daily_close_previewed' AND target_label = '$TODAY';" 2 "preview audit log がありません"
assert_sql_number_ge "SELECT COUNT(*) FROM audit_logs WHERE action = 'analytics_daily_close_closed' AND target_label = '$TODAY';" 2 "closed audit log がありません"
assert_sql_number_ge "SELECT COUNT(*) FROM audit_logs WHERE action = 'analytics_daily_close_reopened' AND target_label = '$TODAY';" 1 "reopened audit log がありません"
assert_sql_number_ge "SELECT COUNT(*) FROM audit_logs WHERE action = 'analytics_daily_close_exported' AND target_label = '$TODAY-$TODAY';" 1 "exported audit log がありません"
assert_sql_number_ge "SELECT COUNT(*) FROM audit_logs WHERE action = 'analytics_daily_close_rejected' AND target_label = '$TODAY';" 1 "rejected audit log がありません"

pass
