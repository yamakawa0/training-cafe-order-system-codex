INSERT INTO payments (
    id, session_id, payment_no, method, status, subtotal, tax_amount, total_amount,
    provider, external_payment_id, idempotency_key, provider_status, provider_payload
)
VALUES (
    /*id*/'pay-dev',
    /*session_id*/'sess-dev',
    /*payment_no*/'PAY-DEV',
    /*method*/'card',
    'paid',
    /*subtotal*/0,
    /*tax_amount*/0,
    /*total_amount*/0,
    COALESCE(NULLIF(/*provider*/'internal', ''), 'internal'),
    NULLIF(/*external_payment_id*/'', ''),
    NULLIF(/*idempotency_key*/'', ''),
    NULLIF(/*provider_status*/'', ''),
    CAST(NULLIF(/*provider_payload*/'', '') AS jsonb)
)
RETURNING
    id, session_id, payment_no, method, status, subtotal, tax_amount, total_amount,
    provider, external_payment_id, idempotency_key, provider_status, provider_payload,
    paid_at, created_at, updated_at;
