SELECT
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
    updated_at
FROM payment_webhook_events
WHERE provider = /*provider*/'mock'
  AND external_event_id = /*external_event_id*/'evt-dev'
LIMIT 1;
