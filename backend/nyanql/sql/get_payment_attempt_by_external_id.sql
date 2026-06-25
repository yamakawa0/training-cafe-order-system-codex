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
    pa.cancelled_at
FROM payment_attempts pa
LEFT JOIN payments p ON p.id = pa.payment_id
WHERE pa.provider = /*provider*/'mock'
  AND pa.external_attempt_id = /*external_attempt_id*/'mock-attempt-dev'
ORDER BY pa.attempted_at DESC
LIMIT 1;
