#!/usr/bin/env bash
set -euo pipefail

export SMOKE_NAME="smoke-checkout-csv"
# shellcheck source=scripts/lib/smoke-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/lib/smoke-lib.sh"

reset_db
login_as manager manager123 analytics-manager

step "注文から精算まで 1 件完了"
session_id="$(open_session customer-T01 T01)"
order_no="$(submit_order customer-T01 T01 '[{"menu_item_id":"item-blend","quantity":1,"choice_ids":["choice-blend-regular"],"customer_note":""}]')"
echo "session_id=$session_id"
echo "order_no=$order_no"
call_get "api/kitchen/tickets?terminal_code=kitchen-main"
item_id="$(first_ticket_id T01 ordered)"
echo "order_item_id=$item_id"
make_item_ready "$item_id"
complete_serve_task_for_item "$item_id"
request_payment T01
payment_id="$(settle_table T01 card)"
echo "payment_id=$payment_id"

step "analytics CSV API が JSON で CSV 文字列を返すことを確認"
call_get "api/analytics/export-sales-csv?terminal_code=analytics-manager&from_date=$TODAY&to_date=$TODAY"
assert_json 'return root.contentType === "text/csv" && root.filename && root.csv' "CSV メタデータが返っていません"
csv_body="$(extract_json 'return root.csv' "CSV 本文が取得できません")"
printf '%s' "$csv_body" | node -e '
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  const lines = input.trim().split(/\r?\n/);
  if (lines.length < 2) process.exit(1);
  const header = lines[0].split(",");
  const required = ["paid_date", "payment_no", "method", "table_code", "menu_item_id", "item_name", "quantity", "sales_total"];
  if (!required.every((name) => header.includes(name))) process.exit(2);
  if (!/card/.test(input) || !/ブレンドコーヒー/.test(input) || !/450/.test(input)) process.exit(3);
});' || fail "CSV のヘッダーまたは売上行が不正です"
echo "CSV_CONTENT_TYPE=$(extract_json 'return root.contentType' "CSV contentType が取得できません")"

step "フロントエンドの /analytics CSV ダウンロード処理が API 仕様と一致することを確認"
grep -q "exportSalesCsv" "$ROOT_DIR/frontend/src/pages/AnalyticsPage.tsx" || fail "AnalyticsPage に CSV ダウンロード処理がありません"
grep -q "/api/analytics/export-sales-csv" "$ROOT_DIR/frontend/src/api/cafeApi.ts" || fail "CSV API が cafeApi に定義されていません"

pass
