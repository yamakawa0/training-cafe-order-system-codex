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
assert_json 'return root.receipt.taxAmount > 0 && root.receipt.totalAmount > 0 && root.receipt.refundTotal === 0 && root.receipt.refundRemaining === root.receipt.totalAmount && root.receipt.refundStatus === "none"' "receipt 税額・合計・返金残額が不正です"
if printf '%s' "$LAST_BODY" | grep -Eq 'unitCostPrice|grossProfit|grossMargin'; then
  fail "receipt に原価または粗利が含まれています"
fi
call_get "api/checkout/receipt?terminal_code=checkout-main&payment_no=$payment_no&reissue=true"
assert_json 'return root.receipt && root.receipt.paymentNo === "'"$payment_no"'"' "payment_no で receipt 再発行できません"

step "部分返金でき、DB に一部返金状態と返金履歴が残ることを確認"
call_post "api/checkout/refund" "{\"terminal_code\":\"checkout-main\",\"payment_id\":\"$payment_id\",\"amount\":200,\"reason\":\"smoke partial refund\"}"
assert_json 'return root.receipt && root.receipt.status === "partial_refunded" && root.refund && root.refund.amount === 200 && root.receipt.refundTotal === 200 && root.receipt.refundRemaining === root.receipt.totalAmount - 200 && root.receipt.refundStatus === "partial_refunded"' "部分返金結果が不正です"
assert_sql "SELECT status FROM payments WHERE id = '$payment_id';" "partial_refunded" "payment が partial_refunded になっていません"
assert_sql "SELECT COUNT(*) FROM payment_refunds WHERE payment_id = '$payment_id' AND status = 'refunded' AND amount > 0;" "1" "1 件目の payment_refunds が作成されていません"

step "部分返金後の分析が純売上になることを確認"
login_as manager manager123 analytics-manager
call_get "api/analytics/summary?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY"
assert_json 'return root.summary && Number(root.summary.gross_sales_total) === 495 && Number(root.summary.refund_total) === 200 && Number(root.summary.net_sales_total) === 295 && Number(root.summary.sales_total) === 295 && Number(root.summary.payment_count) === 1' "部分返金後の分析 net sales が不正です"

step "返金可能残額を超える返金を拒否することを確認"
login_as cashier cashier123 checkout-main
call_post "api/checkout/refund" "{\"terminal_code\":\"checkout-main\",\"payment_id\":\"$payment_id\",\"amount\":9999,\"reason\":\"too much\"}" rejected
assert_json 'return /exceeds|remaining/.test(data.message || "")' "超過返金の拒否理由が不正です"

step "残額全額を追加返金でき、複数返金履歴と refunded 状態になることを確認"
call_post "api/checkout/refund" "{\"terminal_code\":\"checkout-main\",\"payment_id\":\"$payment_id\",\"refund_type\":\"full\",\"reason\":\"smoke final refund\"}"
assert_json 'return root.receipt && root.receipt.status === "refunded" && root.refund && root.refund.amount === 295 && root.receipt.refundTotal === root.receipt.totalAmount && root.receipt.refundRemaining === 0 && root.receipt.refundStatus === "refunded" && root.receipt.refunds.length === 2' "残額全額返金結果が不正です"
assert_sql "SELECT status FROM payments WHERE id = '$payment_id';" "refunded" "payment が refunded になっていません"
assert_sql "SELECT COUNT(*) FROM payment_refunds WHERE payment_id = '$payment_id' AND status = 'refunded' AND amount > 0;" "2" "複数 payment_refunds が作成されていません"

step "refunded payment の追加返金を拒否することを確認"
call_post "api/checkout/refund" "{\"terminal_code\":\"checkout-main\",\"payment_id\":\"$payment_id\",\"amount\":1,\"reason\":\"double refund\"}" rejected
assert_json 'return /paid or partial_refunded|already refunded/.test(data.message || "")' "追加返金の拒否理由が不正です"

step "全額返金済み payment の分析 net sales が 0 になることを確認"
login_as manager manager123 analytics-manager
call_get "api/analytics/summary?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY"
assert_json 'return root.summary && Number(root.summary.gross_sales_total) === 495 && Number(root.summary.refund_total) === 495 && Number(root.summary.net_sales_total) === 0 && Number(root.summary.sales_total) === 0 && Number(root.summary.payment_count) === 1' "全額返金後の分析 net sales が不正です"

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
  for (const name of ["payment_status", "refund_amount", "refunded_at", "refund_reason", "gross_amount", "refund_total", "refund_remaining", "net_amount", "refund_count", "last_refunded_at"]) {
    if (!header.includes(name)) process.exit(2);
  }
  if (!/refunded/.test(input) || !/smoke partial refund/.test(input) || !/smoke final refund/.test(input)) process.exit(3);
});' || fail "CSV の返金列または返金行が不正です"

step "返金 audit log が記録されることを確認"
assert_sql_number_ge "SELECT COUNT(*) FROM audit_logs WHERE action = 'checkout_payment_refunded' AND target_id = '$payment_id' AND status = 'success';" 1 "返金 audit log がありません"
assert_sql_number_ge "SELECT COUNT(*) FROM audit_logs WHERE action = 'checkout_payment_partially_refunded' AND target_id = '$payment_id' AND status = 'success';" 1 "部分返金 audit log がありません"
assert_sql_number_ge "SELECT COUNT(*) FROM audit_logs WHERE action = 'checkout_payment_fully_refunded' AND target_id = '$payment_id' AND status = 'success';" 1 "全額返金 audit log がありません"
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
