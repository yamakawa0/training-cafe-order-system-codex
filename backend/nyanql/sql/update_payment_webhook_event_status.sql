UPDATE payment_webhook_events
SET
    payment_id = NULLIF(/*payment_id*/'', ''),
    refund_id = NULLIF(/*refund_id*/'', ''),
    status = /*status*/'processed',
    processed_at = CASE WHEN /*status*/'processed' IN ('processed', 'ignored', 'failed') THEN CURRENT_TIMESTAMP ELSE processed_at END,
    error_message = NULLIF(/*error_message*/'', ''),
    updated_at = CURRENT_TIMESTAMP
WHERE id = /*id*/'wh-dev'
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
