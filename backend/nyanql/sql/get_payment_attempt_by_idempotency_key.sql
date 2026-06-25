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
    pa.provider,
    pa.external_attempt_id,
    pa.idempotency_key,
    pa.provider_status,
    pa.provider_payload,
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
WHERE pa.idempotency_key = /*idempotency_key*/'idem-dev'
LIMIT 1;
