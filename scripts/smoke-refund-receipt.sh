#!/usr/bin/env bash
set -euo pipefail

export SMOKE_NAME="smoke-refund-receipt"
# shellcheck source=scripts/lib/smoke-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/lib/smoke-lib.sh"

reset_db
login_as cashier cashier123 checkout-main

step "注文から精算まで 1 件完了"
session_id="$(open_session customer-T01 T01)"
order_no="$(submit_order customer-T01 T01 '[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""}]')"
echo "session_id=$session_id"
echo "order_no=$order_no"
login_as kitchen kitchen123 kitchen-main
call_get "api/kitchen/tickets?terminal_code=kitchen-main"
item_id="$(first_ticket_id T01 ordered)"
echo "order_item_id=$item_id"
make_item_ready "$item_id"
login_as hall hall123 hall-main
complete_serve_task_for_item "$item_id"
request_payment T01
login_as cashier cashier123 checkout-main
payment_id="$(settle_table T01 card)"
payment_no="$(sql_scalar "SELECT payment_no FROM payments WHERE id = '$payment_id';" | tail -n 1)"
echo "payment_id=$payment_id"
echo "payment_no=$payment_no"

step "receipt API で明細・税額・合計を取得し原価・粗利が含まれないことを確認"
call_get "api/checkout/receipt?terminal_code=checkout-main&payment_id=$payment_id"
assert_json 'return root.receipt && root.receipt.paymentId && root.receipt.paymentNo && root.receipt.items && root.receipt.items.length === 1' "receipt 明細が取得できません"
assert_json 'return root.receipt.taxAmount > 0 && root.receipt.totalAmount > 0' "receipt 税額・合計が不正です"
if printf '%s' "$LAST_BODY" | grep -Eq 'unitCostPrice|grossProfit|grossMargin'; then
  fail "receipt に原価または粗利が含まれています"
fi
call_get "api/checkout/receipt?terminal_code=checkout-main&payment_no=$payment_no&reissue=true"
assert_json 'return root.receipt && root.receipt.paymentNo === "'"$payment_no"'"' "payment_no で receipt 再発行できません"

step "全額返金でき、DB に返金状態と返金履歴が残ることを確認"
call_post "api/checkout/refund" "{\"terminal_code\":\"checkout-main\",\"payment_id\":\"$payment_id\",\"reason\":\"smoke refund\"}"
assert_json 'return root.receipt && root.receipt.status === "refunded" && root.refund && root.refund.amount === root.receipt.totalAmount' "返金結果が不正です"
assert_sql "SELECT status FROM payments WHERE id = '$payment_id';" "refunded" "payment が refunded になっていません"
assert_sql "SELECT COUNT(*) FROM payment_refunds WHERE payment_id = '$payment_id' AND status = 'refunded' AND amount > 0;" "1" "payment_refunds が作成されていません"

step "二重返金を拒否することを確認"
call_post "api/checkout/refund" "{\"terminal_code\":\"checkout-main\",\"payment_id\":\"$payment_id\",\"reason\":\"double refund\"}" rejected
assert_json 'return /paid payment only|already refunded/.test(data.message || "")' "二重返金の拒否理由が不正です"

step "返金済み payment が分析売上から除外されることを確認"
login_as manager manager123 analytics-manager
call_get "api/analytics/summary?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY"
assert_json 'return root.summary && Number(root.summary.sales_total) === 0 && Number(root.summary.payment_count) === 0' "返金済み payment が分析売上に残っています"

step "売上 CSV に返金列と返金状態が反映されることを確認"
call_get "api/analytics/export-sales-csv?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY"
csv_body="$(extract_json 'return root.csv' "CSV 本文が取得できません")"
printf '%s' "$csv_body" | node -e '
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  const lines = input.trim().split(/\r?\n/);
  if (lines.length < 2) process.exit(1);
  const header = lines[0].split(",");
  for (const name of ["payment_status", "refund_amount", "refunded_at", "refund_reason"]) {
    if (!header.includes(name)) process.exit(2);
  }
  if (!/refunded/.test(input) || !/smoke refund/.test(input)) process.exit(3);
});' || fail "CSV の返金列または返金行が不正です"

step "返金 audit log が記録されることを確認"
assert_sql_number_ge "SELECT COUNT(*) FROM audit_logs WHERE action = 'checkout_payment_refunded' AND target_id = '$payment_id' AND status = 'success';" 1 "返金 audit log がありません"
assert_sql_number_ge "SELECT COUNT(*) FROM audit_logs WHERE action = 'checkout_refund_rejected' AND target_id = '$payment_id' AND status = 'failure';" 1 "返金拒否 audit log がありません"
assert_sql_number_ge "SELECT COUNT(*) FROM audit_logs WHERE action IN ('checkout_receipt_viewed', 'checkout_receipt_reissued') AND target_id = '$payment_id';" 2 "receipt audit log がありません"

step "権限外 role は refund API を拒否されることを確認"
login_as viewer viewer123 analytics-manager
call_post "api/checkout/refund" "{\"terminal_code\":\"checkout-main\",\"payment_id\":\"$payment_id\",\"reason\":\"viewer\"}" rejected
login_as kitchen kitchen123 kitchen-main
call_post "api/checkout/refund" "{\"terminal_code\":\"checkout-main\",\"payment_id\":\"$payment_id\",\"reason\":\"kitchen\"}" rejected
login_as hall hall123 hall-main
call_post "api/checkout/refund" "{\"terminal_code\":\"checkout-main\",\"payment_id\":\"$payment_id\",\"reason\":\"hall\"}" rejected

step "manager は receipt を取得できることを確認"
login_as manager manager123 analytics-manager
call_get "api/checkout/receipt?terminal_code=checkout-main&payment_id=$payment_id"
assert_json 'return root.receipt && root.receipt.status === "refunded"' "manager が receipt を取得できません"

pass
