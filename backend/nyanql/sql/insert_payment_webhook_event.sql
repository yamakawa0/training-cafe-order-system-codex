INSERT INTO payment_webhook_events (
    id,
    provider,
    external_event_id,
    event_type,
    external_payment_id,
    external_refund_id,
    status,
    payload
) VALUES (
    /*id*/'wh-dev',
    /*provider*/'mock',
    /*external_event_id*/'evt-dev',
    /*event_type*/'payment.succeeded',
    NULLIF(/*external_payment_id*/'', ''),
    NULLIF(/*external_refund_id*/'', ''),
    'received',
    CAST(NULLIF(/*payload*/'', '') AS jsonb)
)
RETURNING
    id,
    provider,
    external_event_id,
    event_type,
    external_payment_id,
    external_refund_id,
    payment_id,
    refund_id,
    status,
    payload,
    received_at,
    processed_at,
    error_message,
    created_at,
    updated_at;
