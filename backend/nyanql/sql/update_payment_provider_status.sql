UPDATE payments
SET
    provider_status = NULLIF(/*provider_status*/'', ''),
    provider_payload = COALESCE(CAST(NULLIF(/*provider_payload*/'', '') AS jsonb), provider_payload),
    updated_at = CURRENT_TIMESTAMP
WHERE id = /*payment_id*/'pay-dev'
RETURNING
    id,
    session_id,
    payment_no,
    method,
    status,
    total_amount,
    provider,
    external_payment_id,
    idempotency_key,
    provider_status,
    provider_payload,
    paid_at,
    updated_at;
