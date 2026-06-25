UPDATE payment_attempts
SET status = 'cancelled',
    cancel_reason = COALESCE(NULLIF(/*cancel_reason*/'', ''), ''),
    cancelled_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id = /*attempt_id*/'attempt-dev'
  AND status IN ('pending', 'failed')
RETURNING
    id, session_id, payment_id, attempt_no, method, status, amount, failure_reason,
    cancel_reason, terminal_code, actor_user_id, actor_user_display_name,
    actor_user_role, attempted_at, cancelled_at, created_at, updated_at;
