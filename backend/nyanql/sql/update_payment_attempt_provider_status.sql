UPDATE payment_attempts
SET
    provider_status = NULLIF(/*provider_status*/'', ''),
    provider_payload = COALESCE(CAST(NULLIF(/*provider_payload*/'', '') AS jsonb), provider_payload),
    updated_at = CURRENT_TIMESTAMP
WHERE id = /*attempt_id*/'attempt-dev'
RETURNING
    id,
    session_id,
    payment_id,
    attempt_no,
    method,
    status,
    amount,
    provider,
    external_attempt_id,
    idempotency_key,
    provider_status,
    provider_payload,
    attempted_at,
    updated_at;
