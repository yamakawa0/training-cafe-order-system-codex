SELECT
    pa.id,
    pa.session_id,
    pa.payment_id,
    p.payment_no,
    pa.attempt_no,
    pa.method,
    pa.status,
    pa.amount,
    pa.failure_reason,
    pa.cancel_reason,
    pa.terminal_code,
    pa.actor_user_id,
    pa.actor_user_display_name,
    pa.actor_user_role,
    pa.attempted_at,
    pa.cancelled_at,
    ct.table_code,
    ct.display_name AS table_name
FROM payment_attempts pa
JOIN table_sessions ts ON ts.id = pa.session_id
JOIN cafe_tables ct ON ct.id = ts.table_id
LEFT JOIN payments p ON p.id = pa.payment_id
WHERE (NULLIF(/*session_id*/'', '') IS NULL OR pa.session_id = NULLIF(/*session_id*/'', ''))
  AND (NULLIF(/*payment_id*/'', '') IS NULL OR pa.payment_id = NULLIF(/*payment_id*/'', ''))
  AND (NULLIF(/*attempt_id*/'', '') IS NULL OR pa.id = NULLIF(/*attempt_id*/'', ''))
  AND (NULLIF(/*table_code*/'', '') IS NULL OR ct.table_code = NULLIF(/*table_code*/'', ''))
ORDER BY pa.attempted_at DESC, pa.id DESC;
