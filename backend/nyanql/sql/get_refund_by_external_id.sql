SELECT
    pr.id,
    pr.payment_id,
    pr.refund_no,
    pr.amount,
    pr.status,
    pr.provider,
    pr.external_refund_id,
    pr.idempotency_key,
    pr.provider_status,
    pr.provider_payload,
    pr.refunded_at
FROM payment_refunds pr
WHERE pr.provider = /*provider*/'mock'
  AND pr.external_refund_id = /*external_refund_id*/'mock-ref-dev'
ORDER BY pr.refunded_at DESC
LIMIT 1;
