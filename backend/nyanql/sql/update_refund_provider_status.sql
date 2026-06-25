UPDATE payment_refunds
SET
    provider_status = NULLIF(/*provider_status*/'', ''),
    provider_payload = COALESCE(CAST(NULLIF(/*provider_payload*/'', '') AS jsonb), provider_payload),
    updated_at = CURRENT_TIMESTAMP
WHERE id = /*refund_id*/'refund-dev'
RETURNING
    id,
    payment_id,
    refund_no,
    amount,
    status,
    provider,
    external_refund_id,
    idempotency_key,
    provider_status,
    provider_payload,
    refunded_at,
    updated_at;
