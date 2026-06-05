UPDATE table_sessions
SET
    status = 'payment_requested',
    payment_requested_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id = /*session_id*/'sess-dev'
  AND status IN ('seated', 'ordering')
RETURNING id, table_id, status, payment_requested_at;
