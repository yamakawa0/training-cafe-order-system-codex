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
WHERE (NULLIF(/*provider*/'', '') IS NULL OR provider = NULLIF(/*provider*/'', ''))
  AND (NULLIF(/*status*/'', '') IS NULL OR status = NULLIF(/*status*/'', ''))
  AND (NULLIF(/*payment_id*/'', '') IS NULL OR payment_id = NULLIF(/*payment_id*/'', ''))
  AND (NULLIF(/*refund_id*/'', '') IS NULL OR refund_id = NULLIF(/*refund_id*/'', ''))
ORDER BY received_at DESC, id DESC
LIMIT COALESCE(NULLIF(/*limit*/'50', '')::INTEGER, 50)
OFFSET COALESCE(NULLIF(/*offset*/'0', '')::INTEGER, 0);
