#!/usr/bin/env bash
set -euo pipefail

export SMOKE_NAME="smoke-payment-failure-cancel"
# shellcheck source=scripts/lib/smoke-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/lib/smoke-lib.sh"

prepare_payment_requested_order() {
  local table="$1"
  local terminal="customer-$table"
  local item_id
  open_session "$terminal" "$table" >/dev/null
  submit_order "$terminal" "$table" '[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""}]' >/dev/null
  login_as kitchen kitchen123 kitchen-main
  call_get "api/kitchen/tickets?terminal_code=kitchen-main"
  item_id="$(first_ticket_id "$table" ordered)"
  make_item_ready "$item_id"
  login_as hall hall123 hall-main
  complete_serve_task_for_item "$item_id"
  request_payment "$table"
  login_as cashier cashier123 checkout-main
}

reset_db
login_as cashier cashier123 checkout-main

step "支払い失敗を記録し、売上対象外で session が payment_requested のまま残ることを確認"
prepare_payment_requested_order T01
call_post "api/checkout/settle" '{"terminal_code":"checkout-main","table_code":"T01","method":"card","simulate_result":"failed","failure_reason":"カード承認エラー"}'
assert_json 'return root.paymentAttempt && root.paymentAttempt.status === "failed" && root.paymentAttempt.failureReason === "カード承認エラー"' "failed payment attempt が返りません"
failed_attempt_id="$(extract_json 'return root.paymentAttempt.attemptId' "failed attempt id が取得できません")"
assert_sql "SELECT status FROM table_sessions WHERE id = (SELECT session_id FROM payment_attempts WHERE id = '$failed_attempt_id');" "payment_requested" "failed 後に session が payment_requested ではありません"
assert_sql "SELECT COUNT(*) FROM payments;" "0" "failed settle で payments が作成されています"

step "checkout summary と attempts API に failed attempt が表示されることを確認"
call_get "api/checkout/summary?terminal_code=checkout-main&table_code=T01"
assert_json 'return root.summary && root.summary.latestAttempt && root.summary.latestAttempt.status === "failed"' "summary に failed attempt が表示されません"
call_get "api/checkout/payment-attempts?terminal_code=checkout-main&table_code=T01"
assert_json 'return Array.isArray(root.attempts) && root.attempts.some(attempt => attempt.status === "failed" && attempt.failureReason === "カード承認エラー")' "attempts API に failed attempt がありません"

step "failed attempt は分析売上対象外で、CSV には attempt 状態として出ることを確認"
login_as manager manager123 analytics-manager
call_get "api/analytics/summary?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY"
assert_json 'return root.summary && Number(root.summary.sales_total) === 0 && Number(root.summary.payment_count) === 0' "failed attempt が分析売上に含まれています"
call_get "api/analytics/export-sales-csv?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY"
csv_body="$(extract_json 'return root.csv' "CSV 本文が取得できません")"
printf '%s' "$csv_body" | node -e '
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  const header = input.trim().split(/\r?\n/)[0].split(",");
  for (const name of ["payment_status", "attempt_status", "failure_reason", "cancelled_reason"]) {
    if (!header.includes(name)) process.exit(2);
  }
  if (!/failed/.test(input) || !/カード承認エラー/.test(input)) process.exit(3);
});' || fail "CSV に failed attempt 列が反映されていません"

step "失敗後に再試行して paid 成功し、売上対象になることを確認"
login_as cashier cashier123 checkout-main
payment_id="$(settle_table T01 card)"
echo "payment_id=$payment_id"
assert_sql_number_ge "SELECT COUNT(*) FROM payment_attempts WHERE payment_id = '$payment_id' AND status = 'paid';" 1 "paid attempt が記録されていません"
call_post "api/checkout/settle" '{"terminal_code":"checkout-main","table_code":"T01","method":"card"}' rejected
call_post "api/checkout/cancel-payment" "{\"terminal_code\":\"checkout-main\",\"payment_id\":\"$payment_id\",\"reason\":\"paid cancel\"}" rejected
assert_json 'return /refund|paid|refunded|cannot be cancelled/.test(data.message || "")' "paid payment cancel の拒否理由が不正です"
login_as manager manager123 analytics-manager
call_get "api/analytics/summary?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY"
assert_json 'return root.summary && Number(root.summary.sales_total) > 0 && Number(root.summary.payment_count) === 1' "再試行成功後の売上が分析に反映されていません"
assert_sql_number_ge "SELECT COUNT(*) FROM audit_logs WHERE action = 'checkout_payment_retry_succeeded' AND target_id = '$payment_id' AND status = 'success';" 1 "retry success audit log がありません"

step "別 session の failed attempt を取消し、再試行可能なまま残ることを確認"
login_as cashier cashier123 checkout-main
prepare_payment_requested_order T02
call_post "api/checkout/settle" '{"terminal_code":"checkout-main","table_code":"T02","method":"qr","simulate_result":"failed","failure_reason":"QR 決済タイムアウト"}'
cancel_attempt_id="$(extract_json 'return root.paymentAttempt.attemptId' "cancel target attempt id が取得できません")"
call_post "api/checkout/cancel-payment" "{\"terminal_code\":\"checkout-main\",\"attempt_id\":\"$cancel_attempt_id\",\"reason\":\"顧客が支払い方法を変更\"}"
assert_json 'return root.attempt && root.attempt.status === "cancelled" && root.attempt.cancelReason === "顧客が支払い方法を変更"' "attempt cancel 結果が不正です"
assert_sql "SELECT status FROM table_sessions WHERE id = (SELECT session_id FROM payment_attempts WHERE id = '$cancel_attempt_id');" "payment_requested" "cancel 後に session が payment_requested ではありません"
call_get "api/checkout/receipt?terminal_code=checkout-main&payment_id=$cancel_attempt_id" rejected

step "取消済み attempt は売上対象外で、audit log が記録されることを確認"
login_as manager manager123 analytics-manager
call_get "api/analytics/summary?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY"
assert_json 'return root.summary && Number(root.summary.payment_count) === 1' "cancelled attempt が分析会計件数に含まれています"
assert_sql_number_ge "SELECT COUNT(*) FROM audit_logs WHERE action = 'checkout_payment_failed' AND status = 'success';" 2 "payment failed audit log が不足しています"
assert_sql_number_ge "SELECT COUNT(*) FROM audit_logs WHERE action = 'checkout_payment_cancelled' AND target_id = '$cancel_attempt_id' AND status = 'success';" 1 "payment cancelled audit log がありません"
assert_sql_number_ge "SELECT COUNT(*) FROM audit_logs WHERE action = 'checkout_payment_cancel_rejected' AND target_id = '$payment_id' AND status = 'failure';" 1 "payment cancel rejected audit log がありません"
assert_sql_number_ge "SELECT COUNT(*) FROM audit_logs WHERE action = 'checkout_payment_attempts_viewed' AND status = 'success';" 1 "payment attempts viewed audit log がありません"

step "権限外 role は cancel-payment を拒否されることを確認"
login_as viewer viewer123 analytics-manager
call_post "api/checkout/cancel-payment" "{\"terminal_code\":\"checkout-main\",\"attempt_id\":\"$cancel_attempt_id\",\"reason\":\"viewer\"}" rejected
login_as kitchen kitchen123 kitchen-main
call_post "api/checkout/cancel-payment" "{\"terminal_code\":\"checkout-main\",\"attempt_id\":\"$cancel_attempt_id\",\"reason\":\"kitchen\"}" rejected
login_as hall hall123 hall-main
call_post "api/checkout/cancel-payment" "{\"terminal_code\":\"checkout-main\",\"attempt_id\":\"$cancel_attempt_id\",\"reason\":\"hall\"}" rejected

pass
