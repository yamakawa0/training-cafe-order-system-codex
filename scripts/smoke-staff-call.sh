#!/usr/bin/env bash
set -euo pipefail

SMOKE_NAME="smoke-staff-call"
source "$(cd "$(dirname "$0")" && pwd)/lib/smoke-lib.sh"

reset_db
login_as manager manager123 analytics-manager

step "注文が存在しない状態で customer-T01 の席セッションを開始"
session_id="$(open_session customer-T01 T01)"
echo "session_id=$session_id"
assert_sql "SELECT COUNT(*) FROM orders WHERE session_id = '$session_id'" "0" "注文なしのセッションではありません"

step "customer-T01 から staff-call を作成"
call_post "api/customer/staff-call" '{"terminal_code":"customer-T01","table_code":"T01","note":"水をお願いします"}'
staff_task_id="$(extract_json 'return root.task && root.task.id' "staff_call task_id が取得できません")"
echo "staff_task_id=$staff_task_id"
assert_sql "SELECT task_type FROM hall_tasks WHERE id = '$staff_task_id'" "staff_call" "hall_tasks に staff_call が作成されていません"

step "ホール API で staff_call タスクを取得"
call_get "api/hall/tasks?terminal_code=hall-main"
assert_json "return (root.tasks || []).some(row => row.id === '$staff_task_id' && row.task_type === 'staff_call')" "ホール API で staff_call が取得できません"

step "staff_call タスクを todo -> doing -> done に進める"
complete_task "$staff_task_id"
assert_sql "SELECT status FROM hall_tasks WHERE id = '$staff_task_id'" "done" "staff_call が done ではありません"

step "完了済み staff_call の再完了を拒否"
call_post "api/hall/task/status" "{\"terminal_code\":\"hall-main\",\"task_id\":\"$staff_task_id\",\"status\":\"done\"}" rejected

step "存在しない table_code では staff-call を拒否"
call_post "api/customer/staff-call" '{"terminal_code":"customer-T01","table_code":"T99","note":"invalid table"}' rejected

step "顧客端末以外では staff-call を拒否"
call_post "api/customer/staff-call" '{"terminal_code":"hall-main","table_code":"T01","note":"invalid terminal"}' rejected

pass
