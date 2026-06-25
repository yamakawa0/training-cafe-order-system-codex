SELECT
    p.id,
    p.session_id,
    p.payment_no,
    p.method,
    p.status,
    p.subtotal,
    p.tax_amount,
    p.total_amount,
    p.provider,
    p.external_payment_id,
    p.idempotency_key,
    p.provider_status,
    p.provider_payload,
    p.paid_at,
    ct.table_code,
    ct.display_name AS table_name
FROM payments p
JOIN table_sessions ts ON ts.id = p.session_id
JOIN cafe_tables ct ON ct.id = ts.table_id
WHERE p.idempotency_key = /*idempotency_key*/'idem-dev'
LIMIT 1;
