SELECT
    p.id,
    p.session_id,
    p.payment_no,
    p.method,
    p.status,
    p.total_amount,
    p.provider,
    p.external_payment_id,
    p.idempotency_key,
    p.provider_status,
    p.provider_payload,
    p.paid_at
FROM payments p
WHERE p.provider = /*provider*/'mock'
  AND p.external_payment_id = /*external_payment_id*/'mock-pay-dev'
ORDER BY p.paid_at DESC
LIMIT 1;
