SELECT
    pr.id,
    pr.payment_id,
    p.payment_no,
    pr.refund_no,
    pr.amount,
    pr.reason,
    pr.status,
    pr.provider,
    pr.external_refund_id,
    pr.idempotency_key,
    pr.provider_status,
    pr.provider_payload,
    pr.refunded_at,
    pr.actor_user_id,
    pr.actor_user_display_name,
    pr.actor_user_role,
    pr.actor_terminal_code
FROM payment_refunds pr
JOIN payments p ON p.id = pr.payment_id
WHERE pr.idempotency_key = /*idempotency_key*/'refund-idem-dev'
LIMIT 1;
